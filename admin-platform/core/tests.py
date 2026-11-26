import hashlib
import hmac
import json
import time
from datetime import timedelta
from pathlib import Path
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from core.models import AuditLog, Domain, GatewayCredential, Site, SiteMembership
from monitoring.models import AlertEvent, GatewayMetricBucket, PageEvent, ProbeResult
from monitoring.services import compute_site_overview
from publishing.models import ApprovedAsset, ContentSnapshot, ManagedProduct, ReleaseRecord
from publishing.pipeline import (
    approve_snapshot,
    build_and_deploy_domain,
    create_snapshot,
    rollback_domain,
)

User = get_user_model()


def _sign_gateway_headers(cred: GatewayCredential, matched_domain: str, raw_body: bytes) -> dict:
    ts = str(int(time.time()))
    sig = cred.sign_payload(ts, matched_domain, raw_body)
    return {
        "HTTP_X_GATEWAY_ID": cred.gateway_id,
        "HTTP_X_GATEWAY_TIMESTAMP": ts,
        "HTTP_X_MATCHED_DOMAIN": matched_domain,
        "HTTP_X_GATEWAY_SIGNATURE": sig,
    }


class Stage1SitesRBACAndAuditTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_test_env")

    def test_strong_password_validator_rejects_weak_passwords(self):
        with self.assertRaises(ValidationError):
            validate_password("short1!A")
        with self.assertRaises(ValidationError):
            validate_password("alllowercase1234!")
        with self.assertRaises(ValidationError):
            validate_password("NoSpecialChar1234")
        # Strong password passes
        validate_password("Zh@StrongPass2026!#")

    def test_seeded_sites_domains_and_pending_icp_protection(self):
        zh = Site.objects.get(slug="zhaohui")
        sim = Site.objects.get(slug="sim-site")
        self.assertFalse(zh.online_inquiry_enabled)
        self.assertFalse(sim.online_inquiry_enabled)

        d_main = Domain.objects.get(official_domain="jszhff.cn")
        d_pending = Domain.objects.get(official_domain="zhaohuifangfu.com")
        d_sim = Domain.objects.get(official_domain="sim-site.localhost")

        self.assertEqual(d_main.domain_status, Domain.STATUS_ACTIVE)
        self.assertEqual(d_main.get_canonical_base(), "https://jszhff.cn")

        self.assertEqual(d_pending.domain_status, Domain.STATUS_PENDING_ICP)
        self.assertFalse(d_pending.public_enabled)
        self.assertEqual(d_pending.get_canonical_base(), "https://jszhff.cn")

        self.assertEqual(d_sim.domain_status, Domain.STATUS_ACTIVE)
        self.assertEqual(d_sim.get_canonical_base(), "https://sim-site.localhost")

        # Pending ICP domain cannot be enabled publicly
        d_pending.public_enabled = True
        with self.assertRaises(ValidationError):
            d_pending.clean()

    def test_bidirectional_cross_site_isolation_four_entry_points(self):
        """Stage 1 acceptance: Editor cannot read/write another site via list, detail, direct URL/API, or export."""
        zh_prod = ManagedProduct.objects.get(site__slug="zhaohui", slug="tanks")
        sim_prod = ManagedProduct.objects.get(site__slug="sim-site", slug="sim-vessel")

        # Direction A: zhaohui_editor trying to access sim-site
        c_zh = Client()
        self.assertTrue(c_zh.login(username="zhaohui_editor", password="Zh@Edit2026!#81"))

        # 1. List (overview & admin changelist): only zhaohui visible, never sim-site
        r_list = c_zh.get("/overview/")
        self.assertEqual(r_list.status_code, 200)
        self.assertContains(r_list, "兆辉官网")
        self.assertNotContains(r_list, "华东耐蚀演示站")

        r_admin_list = c_zh.get("/admin/publishing/managedproduct/")
        self.assertEqual(r_admin_list.status_code, 200)
        self.assertContains(r_admin_list, "储罐")
        self.assertNotContains(r_admin_list, "演示耐蚀容器")

        # 2. Detail (Django Admin object change page & studio)
        r_admin_detail = c_zh.get(f"/admin/publishing/managedproduct/{sim_prod.id}/change/")
        self.assertEqual(r_admin_detail.status_code, 403)
        r_studio_other = c_zh.get("/publishing/sim-site/")
        self.assertEqual(r_studio_other.status_code, 403)

        # 3. Direct URL & API requests (overview filter, JSON API, POST edit)
        self.assertEqual(c_zh.get("/overview/?site=sim-site").status_code, 403)
        self.assertEqual(c_zh.get("/api/sites/sim-site/overview/").status_code, 403)
        self.assertEqual(c_zh.get("/publishing/api/sim-site/products/").status_code, 403)
        self.assertEqual(
            c_zh.post(
                f"/publishing/sim-site/products/{sim_prod.id}/save/",
                {"display_name": "篡改测试", "summary": "x", "approved_asset_id": sim_prod.approved_asset_id},
            ).status_code,
            403,
        )

        # 4. Data Exports (CSV & JSON)
        self.assertEqual(c_zh.get("/overview/export.csv?site=sim-site").status_code, 403)
        self.assertEqual(c_zh.get("/overview/export.json?site=sim-site").status_code, 403)

        # Direction B: sim_editor trying to access zhaohui
        c_sim = Client()
        self.assertTrue(c_sim.login(username="sim_editor", password="Sim@Edit2026!#84"))
        self.assertEqual(c_sim.get("/overview/?site=zhaohui").status_code, 403)
        self.assertEqual(c_sim.get("/api/sites/zhaohui/overview/").status_code, 403)
        self.assertEqual(c_sim.get("/publishing/api/zhaohui/products/").status_code, 403)
        self.assertEqual(c_sim.get(f"/admin/publishing/managedproduct/{zh_prod.id}/change/").status_code, 403)
        self.assertEqual(c_sim.get("/overview/export.csv?site=zhaohui").status_code, 403)
        self.assertEqual(c_sim.get("/overview/export.json?site=zhaohui").status_code, 403)

    def test_viewer_is_strictly_read_only_and_export_creates_audit_log(self):
        c_view = Client()
        self.assertTrue(c_view.login(username="zhaohui_viewer", password="Zh@View2026!#82"))

        # Allowed: authorized site overview & exports
        r_ov = c_view.get("/overview/?site=zhaohui")
        self.assertEqual(r_ov.status_code, 200)
        self.assertContains(r_ov, "未启用线上收件")

        before_audit = AuditLog.objects.filter(actor_username="zhaohui_viewer", action="export.csv").count()
        r_csv = c_view.get("/overview/export.csv?site=zhaohui")
        self.assertEqual(r_csv.status_code, 200)
        self.assertEqual(
            AuditLog.objects.filter(actor_username="zhaohui_viewer", action="export.csv").count(),
            before_audit + 1,
        )

        # Denied: other site overview, studio edit, snapshot create, admin
        self.assertEqual(c_view.get("/overview/?site=sim-site").status_code, 403)
        self.assertEqual(c_view.get("/publishing/zhaohui/").status_code, 403)
        self.assertEqual(c_view.post("/publishing/zhaohui/snapshots/create/", {"note": "no"}).status_code, 403)
        # Non-staff viewer redirected/denied at /admin/
        r_admin = c_view.get("/admin/")
        self.assertIn(r_admin.status_code, (302, 403))


class Stage2MonitoringAndDiagnosticsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_test_env")

    def test_ingest_whitelist_spoof_override_preview_exclusion_and_privacy(self):
        cred = GatewayCredential.objects.get(gateway_id="local-test-gw-01")
        client = Client()

        # 1. Spoofed site + sensitive form/clipboard fields + query string
        payload = {
            "event_type": "brief_copy_success",
            "page_path": "/products/tanks?phone=13306170776&medium=HF&secret=abc#brief",
            "product_category": "tanks",
            "site": "sim-site",  # spoofed! must be overridden by jszhff.localhost -> zhaohui
            "clipboard_text": "SENSITIVE_CLIPBOARD_BODY",
            "form_medium": "31% 盐酸敏感输入",
            "phone": "133-0617-0776",
            "email": "secret@buyer.com",
            "referer": "https://private.example.com/internal?token=xyz",
        }
        raw = json.dumps(payload).encode("utf-8")
        resp = client.post(
            "/api/ingest/event",
            data=raw,
            content_type="application/json",
            **_sign_gateway_headers(cred, "jszhff.localhost", raw),
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertEqual(data["attributed_site"], "zhaohui")
        self.assertEqual(data["attributed_domain"], "jszhff.cn")
        self.assertTrue(data["site_override_applied"])
        self.assertGreaterEqual(data["dropped_non_whitelist_count"], 5)

        ev = PageEvent.objects.get(id=data["id"])
        self.assertEqual(ev.site.slug, "zhaohui")
        self.assertEqual(ev.page_path, "/products/tanks/")
        self.assertEqual(ev.product_category, "tanks")

        # 2. Preview host excluded
        pv_raw = json.dumps({"event_type": "page_view", "page_path": "/"}).encode("utf-8")
        r_prev = client.post(
            "/api/ingest/event",
            data=pv_raw,
            content_type="application/json",
            **_sign_gateway_headers(cred, "preview-jszhff.localhost", pv_raw),
        )
        self.assertEqual(r_prev.status_code, 202)
        self.assertEqual(r_prev.json()["reason"], "preview_excluded")

        # 3. Unknown host & pending_icp host excluded
        r_unk = client.post(
            "/api/ingest/event",
            data=pv_raw,
            content_type="application/json",
            **_sign_gateway_headers(cred, "evil-unknown.localhost", pv_raw),
        )
        self.assertEqual(r_unk.status_code, 202)
        self.assertEqual(r_unk.json()["reason"], "unknown_domain_excluded")

        r_pend = client.post(
            "/api/ingest/event",
            data=pv_raw,
            content_type="application/json",
            **_sign_gateway_headers(cred, "zhaohuifangfu.localhost", pv_raw),
        )
        self.assertEqual(r_pend.status_code, 202)
        self.assertEqual(r_pend.json()["reason"], "domain_pending_icp_excluded")

        # 4. Unsigned / forged gateway rejected
        r_forged = client.post(
            "/api/ingest/event",
            data=pv_raw,
            content_type="application/json",
            HTTP_X_GATEWAY_ID="local-test-gw-01",
            HTTP_X_GATEWAY_TIMESTAMP=str(int(time.time())),
            HTTP_X_MATCHED_DOMAIN="jszhff.localhost",
            HTTP_X_GATEWAY_SIGNATURE="deadbeef",
        )
        self.assertEqual(r_forged.status_code, 403)

        # 5. Export contains zero sensitive strings
        client.login(username="zhaohui_viewer", password="Zh@View2026!#82")
        exported = client.get("/overview/export.json?site=zhaohui").content.decode("utf-8")
        for forbidden in ("SENSITIVE_CLIPBOARD_BODY", "31% 盐酸敏感输入", "secret@buyer.com", "token=xyz"):
            self.assertNotIn(forbidden, exported)

    def test_four_states_distinction_and_site_sum_equals_domain_sum(self):
        zh = Site.objects.get(slug="zhaohui")
        now = timezone.now()

        # Add a second temporarily active domain & a not_onboarded domain to verify exact sum & all 4 states
        d1 = Domain.objects.get(official_domain="jszhff.cn")
        d1.last_gateway_heartbeat_at = now
        d1.save()
        ProbeResult.objects.create(
            site=zh, domain=d1, probe_url="https://jszhff.localhost/",
            checked_at=now, is_success=True, http_status=200, tls_valid=True,
            cert_days_remaining=360, content_marker_ok=True,
        )

        # True Zero domain (active + healthy + fresh heartbeat + 0 views)
        d_zero = Domain.objects.create(
            site=zh, official_domain="zero-test.jszhff.cn", test_host="zero-test.localhost",
            preview_host="preview-zero-test.localhost", domain_status=Domain.STATUS_ACTIVE,
            collection_status=Domain.COLLECTION_ACTIVE, last_gateway_heartbeat_at=now,
            collection_started_at=now,
        )
        ProbeResult.objects.create(
            site=zh, domain=d_zero, probe_url="https://zero-test.localhost/",
            checked_at=now, is_success=True, http_status=200, tls_valid=True,
            cert_days_remaining=360, content_marker_ok=True,
        )

        # Interrupted domain (active, but heartbeat stale > 60s)
        d_int = Domain.objects.create(
            site=zh, official_domain="int-test.jszhff.cn", test_host="int-test.localhost",
            preview_host="preview-int-test.localhost", domain_status=Domain.STATUS_ACTIVE,
            collection_status=Domain.COLLECTION_INTERRUPTED,
            last_gateway_heartbeat_at=now - timedelta(minutes=10),
        )

        # Not onboarded domain
        d_new = Domain.objects.create(
            site=zh, official_domain="new-test.jszhff.cn", test_host="new-test.localhost",
            preview_host="preview-new-test.localhost", domain_status=Domain.STATUS_NOT_ONBOARDED,
            collection_status=Domain.COLLECTION_NOT_ONBOARDED,
        )

        # Create known events on d1 & d_int
        for _ in range(3):
            PageEvent.objects.create(
                site=zh, domain=d1, event_type=PageEvent.EVENT_PAGE_VIEW,
                page_path="/products/tanks/", product_category="tanks",
                gateway_id="local-test-gw-01", occurred_at=now,
            )
        PageEvent.objects.create(
            site=zh, domain=d_int, event_type=PageEvent.EVENT_PAGE_VIEW,
            page_path="/", product_category="",
            gateway_id="local-test-gw-01", occurred_at=now,
        )

        ov = compute_site_overview(zh, selected_domain=None, range_key="all")
        states_by_domain = {r["domain"].official_domain: r["state"]["code"] for r in ov["domain_rows"]}
        self.assertEqual(states_by_domain["jszhff.cn"], "active_traffic")
        self.assertEqual(states_by_domain["zero-test.jszhff.cn"], "true_zero")
        self.assertEqual(states_by_domain["int-test.jszhff.cn"], "interrupted")
        self.assertEqual(states_by_domain["zhaohuifangfu.com"], "pending_icp")
        self.assertEqual(states_by_domain["new-test.jszhff.cn"], "not_onboarded")

        # Strict site sum == sum of active domains
        active_sum = sum(
            r["page_views"] for r in ov["domain_rows"] if r["domain"].domain_status == Domain.STATUS_ACTIVE
        )
        self.assertEqual(ov["totals"]["page_views"], active_sum)
        self.assertEqual(ov["totals"]["page_views"], 4)


class Stage3PublishingFailureProtectionAndRollbackTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_test_env")

    def test_sim_site_draft_preview_approve_publish_failure_protection_and_rollback(self):
        sim = Site.objects.get(slug="sim-site")
        dom = Domain.objects.get(official_domain="sim-site.localhost")
        admin = User.objects.get(username="platform_admin")

        # Publish v1 baseline
        snap_v1 = sim.snapshots.order_by("id").first()
        rel_v1 = build_and_deploy_domain(
            snapshot=snap_v1, domain=dom, build_type=ReleaseRecord.BUILD_RELEASE, user=admin
        )
        self.assertEqual(rel_v1.status, ReleaseRecord.STATUS_SUCCEEDED)
        self.assertTrue(rel_v1.is_current)
        current_link = settings.SITES_ROOT / dom.test_host / "current"
        self.assertEqual(current_link.resolve(), Path(rel_v1.artifact_dir).resolve())

        # Edit product & create v2 snapshot
        prod = ManagedProduct.objects.get(site=sim, slug="sim-vessel")
        prod.display_name = "演示耐蚀容器（二期升级版）"
        prod.save()
        snap_v2 = create_snapshot(sim, admin, note="二期名称更新")

        # Preview v2
        prev_v2 = build_and_deploy_domain(
            snapshot=snap_v2, domain=dom, build_type=ReleaseRecord.BUILD_PREVIEW, user=admin
        )
        self.assertEqual(prev_v2.status, ReleaseRecord.STATUS_SUCCEEDED)
        preview_html = (settings.SITES_ROOT / dom.test_host / "preview" / "index.html").read_text(encoding="utf-8")
        self.assertIn("演示耐蚀容器（二期升级版）", preview_html)
        self.assertIn(dom.icp_number, preview_html)
        self.assertIn('rel="canonical" href="https://sim-site.localhost/"', preview_html)

        # Approve v2
        approve_snapshot(snap_v2, admin)

        # Simulated publish failure must keep v1 serving!
        failed_rel = build_and_deploy_domain(
            snapshot=snap_v2,
            domain=dom,
            build_type=ReleaseRecord.BUILD_RELEASE,
            user=admin,
            simulate_failure="smoke_error",
        )
        self.assertEqual(failed_rel.status, ReleaseRecord.STATUS_FAILED)
        self.assertFalse(failed_rel.is_current)
        self.assertEqual(current_link.resolve(), Path(rel_v1.artifact_dir).resolve())
        self.assertTrue(AuditLog.objects.filter(action="release.publish_failed", site=sim).exists())

        # Real publish v2 succeeds & switches atomically
        rel_v2 = build_and_deploy_domain(
            snapshot=snap_v2, domain=dom, build_type=ReleaseRecord.BUILD_RELEASE, user=admin
        )
        self.assertEqual(rel_v2.status, ReleaseRecord.STATUS_SUCCEEDED)
        self.assertTrue(rel_v2.is_current)
        self.assertEqual(current_link.resolve(), Path(rel_v2.artifact_dir).resolve())

        # Rollback back to rel_v1 & verify HTML + assets intact
        rb = rollback_domain(dom, rel_v1, admin)
        self.assertEqual(rb.status, ReleaseRecord.STATUS_SUCCEEDED)
        self.assertEqual(rb.build_type, ReleaseRecord.BUILD_ROLLBACK)
        self.assertEqual(current_link.resolve(), Path(rel_v1.artifact_dir).resolve())
        rolled_html = (current_link / "index.html").read_text(encoding="utf-8")
        self.assertIn("演示耐蚀容器", rolled_html)
        self.assertNotIn("二期升级版", rolled_html)
        self.assertTrue((current_link / "assets" / "site.css").is_file())
        self.assertTrue((current_link / "assets" / "tracker.js").is_file())


class ProductionPilotReadinessTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_test_env")

    def test_prune_old_data_dry_run_and_retention_cleanup_with_audit(self):
        import io
        from django.core.management.base import CommandError

        zh = Site.objects.get(slug="zhaohui")
        dom = Domain.objects.get(official_domain="jszhff.cn")
        now = timezone.now()

        # Expired rows (>180d for events/probes, >365d for metrics/resolved alerts/audit logs)
        ev_old = PageEvent.objects.create(
            site=zh, domain=dom, event_type=PageEvent.EVENT_PAGE_VIEW,
            page_path="/", product_category="", gateway_id="gw-01",
            occurred_at=now - timedelta(days=200),
        )
        ev_new = PageEvent.objects.create(
            site=zh, domain=dom, event_type=PageEvent.EVENT_PAGE_VIEW,
            page_path="/products/tanks/", product_category="tanks", gateway_id="gw-01",
            occurred_at=now - timedelta(days=10),
        )

        pr_old = ProbeResult.objects.create(
            site=zh, domain=dom, probe_url="https://jszhff.cn/",
            checked_at=now - timedelta(days=190), is_success=True, http_status=200,
        )
        pr_new = ProbeResult.objects.create(
            site=zh, domain=dom, probe_url="https://jszhff.cn/",
            checked_at=now - timedelta(days=5), is_success=True, http_status=200,
        )

        gm_old = GatewayMetricBucket.objects.create(
            site=zh, domain=dom, gateway_id="gw-01",
            bucket_start=now - timedelta(days=400), total_requests=10,
        )
        gm_new = GatewayMetricBucket.objects.create(
            site=zh, domain=dom, gateway_id="gw-01",
            bucket_start=now - timedelta(days=20), total_requests=5,
        )

        al_resolved_old = AlertEvent.objects.create(
            site=zh, domain=dom, alert_type=AlertEvent.TYPE_HOME_ERROR,
            status=AlertEvent.STATUS_RESOLVED, severity=AlertEvent.SEVERITY_CRITICAL,
            message="old resolved", resolved_at=now - timedelta(days=380),
        )
        al_open_old = AlertEvent.objects.create(
            site=zh, domain=dom, alert_type=AlertEvent.TYPE_TLS_EXPIRING,
            status=AlertEvent.STATUS_OPEN, severity=AlertEvent.SEVERITY_WARNING,
            message="still open alert must never be pruned",
        )
        AlertEvent.objects.filter(id=al_open_old.id).update(opened_at=now - timedelta(days=400))

        au_old = AuditLog.objects.create(
            actor=None, actor_username="legacy_user", site=zh,
            action="auth.login", target_type="user", target_id="1", summary="old audit",
        )
        AuditLog.objects.filter(id=au_old.id).update(created_at=now - timedelta(days=400))

        # Invalid retention days rejected
        with self.assertRaises(CommandError):
            call_command("prune_old_data", events_days=0)

        # Dry-run: accurate candidate counts, zero deletions, zero new audit log
        audit_count_before = AuditLog.objects.count()
        buf_dry = io.StringIO()
        call_command("prune_old_data", dry_run=True, as_json=True, stdout=buf_dry)
        dry_report = json.loads(buf_dry.getvalue())
        self.assertTrue(dry_report["dry_run"])
        self.assertEqual(dry_report["counts"]["page_events"], 1)
        self.assertEqual(dry_report["counts"]["probe_results"], 1)
        self.assertEqual(dry_report["counts"]["gateway_metrics"], 1)
        self.assertEqual(dry_report["counts"]["resolved_alerts"], 1)
        self.assertEqual(dry_report["counts"]["audit_logs"], 1)
        self.assertTrue(PageEvent.objects.filter(id=ev_old.id).exists())
        self.assertTrue(AuditLog.objects.filter(id=au_old.id).exists())
        self.assertEqual(AuditLog.objects.count(), audit_count_before)

        # Real prune run: removes expired rows, keeps recent + open alerts, records AuditLog
        buf_real = io.StringIO()
        call_command("prune_old_data", as_json=True, stdout=buf_real)
        real_report = json.loads(buf_real.getvalue())
        self.assertFalse(real_report["dry_run"])
        self.assertEqual(real_report["counts"]["page_events"], 1)
        self.assertEqual(real_report["counts"]["probe_results"], 1)
        self.assertEqual(real_report["counts"]["gateway_metrics"], 1)
        self.assertEqual(real_report["counts"]["resolved_alerts"], 1)
        self.assertEqual(real_report["counts"]["audit_logs"], 1)

        self.assertFalse(PageEvent.objects.filter(id=ev_old.id).exists())
        self.assertTrue(PageEvent.objects.filter(id=ev_new.id).exists())
        self.assertFalse(ProbeResult.objects.filter(id=pr_old.id).exists())
        self.assertTrue(ProbeResult.objects.filter(id=pr_new.id).exists())
        self.assertFalse(GatewayMetricBucket.objects.filter(id=gm_old.id).exists())
        self.assertTrue(GatewayMetricBucket.objects.filter(id=gm_new.id).exists())
        self.assertFalse(AlertEvent.objects.filter(id=al_resolved_old.id).exists())
        self.assertTrue(AlertEvent.objects.filter(id=al_open_old.id).exists())
        self.assertFalse(AuditLog.objects.filter(id=au_old.id).exists())

        prune_audit = AuditLog.objects.filter(action="system.prune_old_data").first()
        self.assertIsNotNone(prune_audit)
        self.assertEqual(prune_audit.metadata["deleted"]["page_events"], 1)
        self.assertEqual(prune_audit.metadata["retention_days"]["events_days"], 180)
        self.assertEqual(prune_audit.metadata["retention_days"]["audit_days"], 365)

    def test_production_config_validation_and_auth_policy(self):
        from config.settings import (
            AUTH_CAPTCHA_ENABLED,
            AUTH_IP_WHITELIST_ENABLED,
            AUTH_MTLS_REQUIRED,
            DEFAULT_TEST_DB_PASSWORD,
            DEFAULT_TEST_SECRET_KEY,
            validate_production_config,
        )

        # Decision #2: strictly username+password only (no CAPTCHA, no mTLS, no IP whitelist)
        self.assertFalse(AUTH_CAPTCHA_ENABLED)
        self.assertFalse(AUTH_MTLS_REQUIRED)
        self.assertFalse(AUTH_IP_WHITELIST_ENABLED)

        # Insecure defaults must be rejected
        bad_errors = validate_production_config(
            debug=True,
            secret_key=DEFAULT_TEST_SECRET_KEY,
            db_password=DEFAULT_TEST_DB_PASSWORD,
            allowed_hosts=["*"],
            csrf_trusted_origins=["http://admin.jszhff.cn"],
            secure_https=False,
        )
        self.assertEqual(len(bad_errors), 6)

        # Hardened production settings pass cleanly
        ok_errors = validate_production_config(
            debug=False,
            secret_key="prod-only-random-secret-key-at-least-48-chars-long-9a8b7c6d",
            db_password="ProdStrongDbPass!#2026xyz",
            allowed_hosts=["admin.jszhff.cn", "127.0.0.1"],
            csrf_trusted_origins=["https://admin.jszhff.cn"],
            secure_https=True,
        )
        self.assertEqual(ok_errors, [])

        # On-server Next.js build guard when ALLOW_ON_SERVER_BUILD=False
        zh = Site.objects.get(slug="zhaohui")
        dom = Domain.objects.get(official_domain="jszhff.cn")
        snap = zh.snapshots.first()
        admin = User.objects.get(username="platform_admin")
        with override_settings(ALLOW_ON_SERVER_BUILD=False):
            rel = build_and_deploy_domain(
                snapshot=snap, domain=dom, build_type=ReleaseRecord.BUILD_PREVIEW, user=admin
            )
            self.assertEqual(rel.status, ReleaseRecord.STATUS_FAILED)
            self.assertIn("ZHAOHUI_ALLOW_ON_SERVER_BUILD=0", rel.error_message)

    def test_init_prod_pilot_command_and_gateway_scripts_compatibility(self):
        import importlib.util
        import tempfile
        from django.core.management.base import CommandError

        # Reject weak/default gateway secret
        with self.assertRaises(CommandError):
            call_command("init_prod_pilot", gateway_secret=settings.DEFAULT_TEST_GATEWAY_SECRET)

        prod_secret = "f" * 64
        call_command(
            "init_prod_pilot",
            gateway_id="prod-zhaohui-nginx-01",
            gateway_secret=prod_secret,
        )
        cred = GatewayCredential.objects.get(gateway_id="prod-zhaohui-nginx-01")
        self.assertTrue(cred.is_active)
        self.assertEqual(cred.site.slug, "zhaohui")
        d_pending = Domain.objects.get(official_domain="zhaohuifangfu.com")
        self.assertEqual(d_pending.domain_status, Domain.STATUS_PENDING_ICP)
        self.assertFalse(d_pending.public_enabled)

        # Verify ops/prod-pilot/event_forwarder.py signature matches Django GatewayCredential
        fwd_path = Path(settings.REPO_ROOT) / "ops" / "prod-pilot" / "event_forwarder.py"
        spec_fwd = importlib.util.spec_from_file_location("prod_event_forwarder", fwd_path)
        mod_fwd = importlib.util.module_from_spec(spec_fwd)
        spec_fwd.loader.exec_module(mod_fwd)

        raw_ev = b'{"event_type":"page_view","page_path":"/"}'
        ts = str(int(time.time()))
        sig = mod_fwd.compute_gateway_signature(cred.gateway_id, prod_secret, ts, "jszhff.cn", raw_ev)
        self.assertTrue(cred.verify_signature(ts, "jszhff.cn", raw_ev, sig))

        # Verify ops/prod-pilot/nginx_log_aggregator.py incremental read + logrotate drain + signature
        agg_path = Path(settings.REPO_ROOT) / "ops" / "prod-pilot" / "nginx_log_aggregator.py"
        spec_agg = importlib.util.spec_from_file_location("prod_log_aggregator", agg_path)
        mod_agg = importlib.util.module_from_spec(spec_agg)
        spec_agg.loader.exec_module(mod_agg)

        with tempfile.TemporaryDirectory() as td:
            log_file = Path(td) / "jszhff.cn.metrics.log"
            rot_file = Path(td) / "jszhff.cn.metrics.log.1"
            epoch_ts = 1795651200.123
            line1 = json.dumps({
                "msec": f"{epoch_ts:.3f}", "host": "jszhff.cn", "server_name": "jszhff.cn",
                "method": "GET", "uri": "/", "status": 200, "request_time": 0.012,
            })
            line2 = json.dumps({
                "msec": f"{epoch_ts + 1:.3f}", "host": "jszhff.cn", "server_name": "jszhff.cn",
                "method": "GET", "uri": "/_next/static/app.js", "status": 200, "request_time": 0.004,
            })
            line_track = json.dumps({
                "msec": f"{epoch_ts + 2:.3f}", "host": "jszhff.cn", "server_name": "jszhff.cn",
                "method": "POST", "uri": "/_track/event", "status": 201, "request_time": 0.015,
            })
            log_file.write_text(line1 + "\n", encoding="utf-8")

            lines_a, inode_a, off_a = mod_agg.read_incremental_lines(log_file, {"inode": None, "offset": 0})
            self.assertEqual(len(lines_a), 1)

            # Simulate logrotate: append line2 to old file, move to .1, create new log_file with line_track
            with log_file.open("a", encoding="utf-8") as f:
                f.write(line2 + "\n")
            log_file.rename(rot_file)
            log_file.write_text(line_track + "\n", encoding="utf-8")

            lines_b, inode_b, off_b = mod_agg.read_incremental_lines(
                log_file, {"inode": inode_a, "offset": off_a}
            )
            self.assertEqual(len(lines_b), 2)  # drained line2 from .1 + line_track from new file
            self.assertNotEqual(inode_a, inode_b)

            buckets = mod_agg.aggregate_lines(lines_a + lines_b, {"jszhff.cn"})
            self.assertEqual(len(buckets), 1)
            self.assertEqual(buckets[0]["total_requests"], 2)  # /_track/event ignored
            self.assertEqual(buckets[0]["html_requests"], 1)
            self.assertEqual(buckets[0]["static_asset_requests"], 1)
            self.assertEqual(buckets[0]["status_2xx"], 2)

            batch_raw = json.dumps({"gateway_id": cred.gateway_id, "buckets": buckets, "heartbeat_hosts": ["jszhff.cn"]}).encode("utf-8")
            batch_sig = mod_agg.sign_batch(cred.gateway_id, prod_secret, ts, batch_raw)
            self.assertTrue(cred.verify_signature(ts, "__batch__", batch_raw, batch_sig))
