import json
import struct
import tempfile
import zlib
from pathlib import Path
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import Client, TestCase, override_settings
from core.models import AuditLog, Domain, Site
from monitoring.views import normalize_product_category
from publishing.models import ApprovedAsset, ContentSnapshot, ManagedProductArticle, ManagedProductVariant
from publishing.pipeline import (
    BuildPipelineError,
    approve_snapshot,
    build_domain_snapshot_doc,
    build_snapshot_payload,
    create_snapshot,
    sync_site_catalog_to_workspace,
    verify_static_artifact,
)
from publishing.redline_validator import (
    validate_article_redlines,
    validate_payload_catalog_redlines,
    validate_variant_redlines,
)

User = get_user_model()


def _make_valid_png_bytes(width: int = 8, height: int = 6) -> bytes:
    """Build a minimal valid PNG binary using stdlib zlib (zero external deps)."""
    def chunk(ctype: bytes, payload: bytes) -> bytes:
        crc = zlib.crc32(ctype + payload) & 0xFFFFFFFF
        return struct.pack(">I", len(payload)) + ctype + payload + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw_scanlines = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    idat = zlib.compress(raw_scanlines)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


class PublishingCatalogAndAdminUploadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_test_env")

    def test_seeded_catalog_has_all_four_families_18_variants_18_articles_and_zero_redlines(self):
        zh = Site.objects.get(slug="zhaohui")
        variants = list(ManagedProductVariant.objects.filter(site=zh))
        self.assertEqual(len(variants), 18)
        by_cat = {}
        for v in variants:
            by_cat[v.category_slug] = by_cat.get(v.category_slug, 0) + 1
            self.assertGreater(len(v.specs_json), 0)
            # Initial seed records specification categories only; concrete values stay blank for staff entry
            for row in v.specs_json:
                self.assertEqual(row.get("value", ""), "")
            # Every single product variant has at least 1 published technical article
            self.assertGreaterEqual(
                ManagedProductArticle.objects.filter(
                    site=zh, variant=v, status=ManagedProductArticle.STATUS_PUBLISHED
                ).count(),
                1,
                f"Variant {v.category_slug}/{v.variant_slug} is missing a published article",
            )
        self.assertEqual(by_cat, {"tanks": 5, "reactors": 6, "towers": 4, "piping": 3})
        self.assertEqual(
            ManagedProductArticle.objects.filter(site=zh, status=ManagedProductArticle.STATUS_PUBLISHED).count(),
            18,
        )

        # All 18 seed variants & 18 seed articles must pass redline gate with 0 errors and 0 warnings
        payload = build_snapshot_payload(zh)
        redline_report = validate_payload_catalog_redlines(payload)
        self.assertTrue(redline_report["passed"], f"Redline errors: {redline_report['errors']}")
        self.assertEqual(redline_report["errors"], [])
        self.assertEqual(redline_report["warnings"], [], f"Redline warnings: {redline_report['warnings']}")

    def test_monitoring_subpath_category_attribution(self):
        self.assertEqual(normalize_product_category("", "/products/tanks/ptfe/"), "tanks")
        self.assertEqual(
            normalize_product_category("", "/products/tanks/ptfe/article_ptfe-tank-selection-conditions/"),
            "tanks",
        )
        self.assertEqual(normalize_product_category("", "/products/piping/po/"), "piping")
        self.assertEqual(normalize_product_category("", "/"), "")

    def test_redline_validator_blocks_forbidden_words_and_warns_unconfirmed_specs(self):
        bad = validate_variant_redlines(
            title="钢衬四氟储罐",
            craft_tag="板衬工艺",
            summary="本产品耐所有酸碱且永不腐蚀，做到行业第一零维护。",
            specs_json=[],
        )
        self.assertFalse(bad["passed"])
        self.assertGreaterEqual(len(bad["errors"]), 4)

        warn = validate_variant_redlines(
            title="钢衬四氟储罐",
            craft_tag="板衬工艺",
            summary="采用 Q235B 壳体，喷涂 F46，最高耐温 180°C。",
            specs_json=[{"group": "基本规格", "label": "设计压力", "value": "0.6 MPa", "unit": "MPa", "note": ""}],
        )
        self.assertTrue(warn["passed"])
        self.assertTrue(warn["requires_confirmation"])
        terms = " ".join(w["term"] for w in warn["warnings"])
        self.assertIn("Q235B", terms)
        self.assertIn("F46", terms)
        self.assertIn("180°C", terms)
        self.assertIn("0.6 MPa", terms)

        # High-risk medium without 专项审核 triggers warning; with 专项审核 clears it
        hf_warn = validate_article_redlines(
            title="氢氟酸储罐选型",
            summary="讨论氢氟酸储罐配置",
            body_markdown="氢氟酸介质需要认真对待。",
        )
        self.assertTrue(hf_warn["requires_confirmation"])
        hf_ok = validate_article_redlines(
            title="氢氟酸项目为什么要先沟通 SDS",
            summary="氢氟酸工况统一进入技术专项审核",
            body_markdown="涉及氢氟酸的项目必须先交由技术负责人专项审核。",
        )
        self.assertFalse(hf_ok["requires_confirmation"])

    def test_asset_upload_validation_and_inline_json_response(self):
        client = Client()
        self.assertTrue(client.login(username="zhaohui_editor", password="Zh@Edit2026!#81"))

        with tempfile.TemporaryDirectory() as td:
            with override_settings(MANAGED_UPLOAD_DIR=Path(td)):
                # 1. Valid PNG upload via JSON/AJAX (article inline upload)
                png_file = SimpleUploadedFile("flange-detail.png", _make_valid_png_bytes(16, 12), content_type="image/png")
                resp = client.post(
                    "/publishing/zhaohui/assets/upload/",
                    {
                        "image_file": png_file,
                        "label": "法兰翻边细节",
                        "image_alt": "钢衬四氟储罐顶部法兰白色翻边实拍",
                    },
                    HTTP_X_REQUESTED_WITH="XMLHttpRequest",
                )
                self.assertEqual(resp.status_code, 201)
                data = resp.json()
                self.assertTrue(data["ok"])
                self.assertTrue(data["image_path"].startswith("/images/site/managed/"))
                self.assertIn("![钢衬四氟储罐顶部法兰白色翻边实拍]", data["markdown"])

                asset = ApprovedAsset.objects.get(id=data["id"])
                self.assertEqual(asset.width, 16)
                self.assertEqual(asset.height, 12)
                self.assertTrue(AuditLog.objects.filter(action="asset.upload", target_id=str(asset.id)).exists())

                # 2. Fake/corrupt PNG header rejected
                bad_file = SimpleUploadedFile("evil.png", b"NOT_A_REAL_PNG_FILE_CONTENT", content_type="image/png")
                resp_bad = client.post(
                    "/publishing/zhaohui/assets/upload/",
                    {"image_file": bad_file, "label": "伪造图", "image_alt": "伪造图片说明"},
                    HTTP_X_REQUESTED_WITH="XMLHttpRequest",
                )
                self.assertEqual(resp_bad.status_code, 400)
                self.assertFalse(resp_bad.json()["ok"])

                # 3. Unsupported extension rejected
                svg_file = SimpleUploadedFile("xss.svg", b"<svg></svg>", content_type="image/svg+xml")
                resp_svg = client.post(
                    "/publishing/zhaohui/assets/upload/",
                    {"image_file": svg_file, "label": "矢量图", "image_alt": "矢量测试"},
                    HTTP_X_REQUESTED_WITH="XMLHttpRequest",
                )
                self.assertEqual(resp_svg.status_code, 400)

    def test_variant_spec_edit_csv_import_and_article_md_upload(self):
        client = Client()
        self.assertTrue(client.login(username="zhaohui_editor", password="Zh@Edit2026!#81"))

        zh = Site.objects.get(slug="zhaohui")
        variant = ManagedProductVariant.objects.get(site=zh, category_slug="tanks", variant_slug="ptfe")

        # 1. Visual edit blocked by redline superlative
        resp_block = client.post(
            f"/publishing/zhaohui/variants/{variant.id}/edit/",
            {
                "title": variant.title,
                "craft_tag": variant.craft_tag,
                "display_order": 1,
                "is_published": "1",
                "summary": "永不腐蚀且耐所有酸碱的储罐。",
                "hero_asset_id": variant.hero_asset_id,
                "specs_json_payload": json.dumps(variant.specs_json, ensure_ascii=False),
                "confirm_inputs_lines": "容积\n介质",
            },
        )
        self.assertEqual(resp_block.status_code, 200)
        self.assertContains(resp_block, "内容红线硬性拦截")

        # 2. CSV batch upload import works
        csv_content = (
            "规格分类,规格种类,规格参数,单位,口径与说明\n"
            "基本规格,公称容积,10 / 20 / 50 / 100,m³,常用容积档位，支持非标定制\n"
            "基本规格,结构形式,立式 / 卧式,,按现场空间布置选定\n"
        ).encode("utf-8")
        csv_file = SimpleUploadedFile("tanks-ptfe-specs.csv", csv_content, content_type="text/csv")
        resp_csv = client.post(
            f"/publishing/zhaohui/variants/{variant.id}/import-specs/",
            {"specs_file": csv_file},
        )
        self.assertEqual(resp_csv.status_code, 302)
        variant.refresh_from_db()
        self.assertEqual(len(variant.specs_json), 2)
        self.assertEqual(variant.specs_json[0]["value"], "10 / 20 / 50 / 100")

        # 3. Upload Markdown article (.md) -> auto extracts H1, summary, and adds article_ prefix
        md_bytes = (
            "# 钢衬四氟储罐出厂检验重点核查项目\n\n"
            "出厂前重点检查壳体焊缝、衬里连续性与法兰翻边平整度。\n\n"
            "## 检验清单\n\n"
            "- 核查法兰端面翻边贴合度\n"
            "- 核对项目技术协议留档记录\n"
        ).encode("utf-8")
        md_file = SimpleUploadedFile("factory-qc-checklist.md", md_bytes, content_type="text/markdown")
        resp_art = client.post(
            f"/publishing/zhaohui/variants/{variant.id}/articles/create/",
            {
                "markdown_file": md_file,
                "article_slug": "factory-qc-checklist",
                "status": "published",
                "published_at": "2026-11-27",
            },
        )
        self.assertEqual(resp_art.status_code, 302)
        created_art = ManagedProductArticle.objects.get(variant=variant, article_slug="article_factory-qc-checklist")
        self.assertEqual(created_art.title, "钢衬四氟储罐出厂检验重点核查项目")
        self.assertIn("法兰翻边平整度", created_art.summary)
        self.assertNotIn("# 钢衬四氟储罐出厂检验重点核查项目", created_art.body_markdown)

    def test_snapshot_v11_redline_approval_gate_and_dev_sync(self):
        zh = Site.objects.get(slug="zhaohui")
        editor = User.objects.get(username="zhaohui_editor")
        publisher = User.objects.get(username="zhaohui_publisher")
        variant = ManagedProductVariant.objects.get(site=zh, category_slug="tanks", variant_slug="po")

        # Add an unconfirmed steel grade warning to trigger publisher confirmation gate
        variant.specs_json = [
            {"group": "壳体与衬里", "label": "承压壳体", "value": "Q235B 碳钢", "unit": "", "note": "需技术审核确认"}
        ]
        variant.save()

        snap = create_snapshot(zh, editor, note="含待审核壳体牌号测试")
        self.assertEqual(snap.payload["schemaVersion"], "1.1")
        self.assertEqual(len(snap.payload["variants"]), 18)

        # Without redline_confirmed=True, approval must fail
        with self.assertRaises(BuildPipelineError):
            approve_snapshot(snap, publisher, redline_confirmed=False)

        # With explicit Publisher confirmation, approval succeeds
        approve_snapshot(snap, publisher, redline_confirmed=True)
        snap.refresh_from_db()
        self.assertEqual(snap.status, ContentSnapshot.STATUS_APPROVED)

        # Dev Sync writes managed-catalog.json cleanly in dev mode, blocked when disabled
        with tempfile.TemporaryDirectory() as td:
            out_catalog = Path(td) / "managed-catalog.json"
            with override_settings(LOCAL_DEV_SYNC_ENABLED=True, MANAGED_CATALOG_PATH=out_catalog):
                res = sync_site_catalog_to_workspace(zh, editor)
                self.assertEqual(res["published_variants"], 18)
                written = json.loads(out_catalog.read_text(encoding="utf-8"))
                self.assertEqual(written["schemaVersion"], "1.1")
                self.assertEqual(len(written["variants"]), 18)
                self.assertEqual(len(written["articles"]), 18)

            with override_settings(LOCAL_DEV_SYNC_ENABLED=False, MANAGED_CATALOG_PATH=out_catalog):
                with self.assertRaises(BuildPipelineError):
                    sync_site_catalog_to_workspace(zh, editor)

    def test_cross_site_rbac_isolation_on_variants_articles_and_assets(self):
        zh = Site.objects.get(slug="zhaohui")
        variant = ManagedProductVariant.objects.filter(site=zh).first()
        article = ManagedProductArticle.objects.filter(site=zh).first()

        # sim_editor cannot access zhaohui variants / articles / assets / dev-sync
        c_sim = Client()
        self.assertTrue(c_sim.login(username="sim_editor", password="Sim@Edit2026!#84"))
        self.assertEqual(c_sim.get("/publishing/zhaohui/variants/").status_code, 403)
        self.assertEqual(c_sim.get(f"/publishing/zhaohui/variants/{variant.id}/edit/").status_code, 403)
        self.assertEqual(c_sim.get(f"/publishing/zhaohui/variants/{variant.id}/articles/").status_code, 403)
        self.assertEqual(
            c_sim.get(f"/publishing/zhaohui/variants/{variant.id}/articles/{article.id}/edit/").status_code,
            403,
        )
        self.assertEqual(c_sim.get("/publishing/zhaohui/assets/").status_code, 403)
        self.assertEqual(c_sim.post("/publishing/zhaohui/dev-sync/").status_code, 403)

        # zhaohui_viewer cannot edit or access publishing workspace
        c_view = Client()
        self.assertTrue(c_view.login(username="zhaohui_viewer", password="Zh@View2026!#82"))
        self.assertEqual(c_view.get("/publishing/zhaohui/variants/").status_code, 403)
        self.assertEqual(c_view.get("/publishing/zhaohui/assets/").status_code, 403)

    def test_verify_static_artifact_validates_variants_articles_and_sitemap(self):
        zh = Site.objects.get(slug="zhaohui")
        dom = Domain.objects.get(official_domain="jszhff.cn")
        snap = zh.snapshots.order_by("-id").first()
        # Rebuild snapshot payload with v1.1 variants & articles
        snap.payload = build_snapshot_payload(zh)
        snap.save(update_fields=["payload"])
        domain_doc = build_domain_snapshot_doc(snap, dom, "release")

        # Verify against real built out/ directory if present
        out_dir = Path(self.settings_repo_root()) / "out"
        if (out_dir / "index.html").is_file() and (out_dir / "sitemap.xml").is_file():
            passed, report = verify_static_artifact(out_dir, domain_doc)
            self.assertTrue(passed, f"Smoke verification failed: {report.get('errors')}")

    @staticmethod
    def settings_repo_root():
        from django.conf import settings
        return settings.REPO_ROOT
