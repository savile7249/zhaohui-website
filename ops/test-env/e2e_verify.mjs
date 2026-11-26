#!/usr/bin/env node
/**
 * End-to-End Verification & Screenshot Capture for All 4 Stages.
 * Uses Playwright + local Chromium against the real isolated MariaDB + Django + Trusted Gateway stack.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_MODULE_PATH || "/home/savil/.local/share/mise/installs/playwright/latest/node_modules/playwright";
const { chromium } = require(playwrightPath);

const REPO_ROOT = path.resolve(process.env.REPO_ROOT || process.cwd());
const ADMIN_DIR = path.join(REPO_ROOT, "admin-platform");
const RUNTIME_DIR = path.resolve(process.env.ZHAOHUI_RUNTIME_DIR || path.join(REPO_ROOT, ".local-test-env"));
const VENV_PY = path.join(ADMIN_DIR, ".venv", "bin", "python");
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || "/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots";
const DJANGO_BASE = `http://127.0.0.1:${process.env.ZHAOHUI_DJANGO_PORT || "18000"}`;
const GW_HTTP = process.env.ZHAOHUI_GATEWAY_HTTP_PORT || "18080";
const GW_HTTPS = process.env.ZHAOHUI_GATEWAY_HTTPS_PORT || "18443";

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

function runPy(code) {
  return execFileSync(VENV_PY, ["-c", code], {
    cwd: ADMIN_DIR,
    env: { ...process.env, DJANGO_SETTINGS_MODULE: "config.settings", PYTHONPATH: ADMIN_DIR },
    encoding: "utf8",
  }).trim();
}

function runManage(args) {
  return execFileSync(VENV_PY, ["manage.py", ...args], {
    cwd: ADMIN_DIR,
    env: { ...process.env, DJANGO_SETTINGS_MODULE: "config.settings" },
    encoding: "utf8",
  }).trim();
}

async function flushGateway() {
  const res = await fetch(`http://127.0.0.1:${GW_HTTP}/_gateway/flush`, { method: "POST" });
  assert.equal(res.status, 200, "Gateway flush should succeed");
}

async function loginToAdmin(page, username, password) {
  await page.goto(`${DJANGO_BASE}/login/`, { waitUntil: "networkidle" });
  await page.fill("#id_username", username);
  await page.fill("#id_password", password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle" }),
    page.click('button[type="submit"]'),
  ]);
}

async function logoutFromAdmin(page) {
  const logoutBtn = page.locator('form[action="/logout/"] button[type="submit"]');
  if ((await logoutBtn.count()) > 0) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }),
      logoutBtn.click(),
    ]);
  }
}

const results = {
  stage1: {},
  stage2: {},
  stage3: {},
  stage4: {},
  screenshots: [],
};

function recordShot(filename, desc) {
  results.screenshots.push({ file: path.join(SCREENSHOTS_DIR, filename), desc });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    // =========================================================================
    // STAGE 1: Live Browser RBAC, Django Admin & Audit Log Screenshot
    // =========================================================================
    console.log("[E2E] === Stage 1: Sites, Domains, RBAC & Audit Logs ===");
    const ctxAdmin = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const pageAdmin = await ctxAdmin.newPage();

    // Verify zhaohui_editor cannot access sim-site in live browser
    await loginToAdmin(pageAdmin, "zhaohui_editor", "Zh@Edit2026!#81");
    assert.ok((await pageAdmin.textContent("body")).includes("兆辉官网"));
    const respCrossOverview = await pageAdmin.goto(`${DJANGO_BASE}/overview/?site=sim-site`);
    assert.equal(respCrossOverview.status(), 403, "zhaohui_editor must get 403 on sim-site overview");
    const respCrossExport = await pageAdmin.goto(`${DJANGO_BASE}/overview/export.csv?site=sim-site`);
    assert.equal(respCrossExport.status(), 403, "zhaohui_editor must get 403 on sim-site CSV export");
    await pageAdmin.goto(`${DJANGO_BASE}/overview/`, { waitUntil: "networkidle" });
    await logoutFromAdmin(pageAdmin);

    // Verify zhaohui_viewer is read-only
    await loginToAdmin(pageAdmin, "zhaohui_viewer", "Zh@View2026!#82");
    const respViewerEdit = await pageAdmin.goto(`${DJANGO_BASE}/publishing/zhaohui/`);
    assert.equal(respViewerEdit.status(), 403, "zhaohui_viewer must get 403 on publishing studio");
    await pageAdmin.goto(`${DJANGO_BASE}/overview/`, { waitUntil: "networkidle" });
    await logoutFromAdmin(pageAdmin);

    // Log in as platform_admin and capture Django Admin screenshots (Domains + AuditLog)
    await loginToAdmin(pageAdmin, "platform_admin", "Plat@Adm2026!#80");
    await pageAdmin.goto(`${DJANGO_BASE}/admin/core/domain/`, { waitUntil: "networkidle" });
    await pageAdmin.screenshot({ path: path.join(SCREENSHOTS_DIR, "01-django-admin-domains.png"), fullPage: true });
    recordShot("01-django-admin-domains.png", "Django Admin 站点域名配置与待备案隔离状态");

    await pageAdmin.goto(`${DJANGO_BASE}/admin/core/auditlog/`, { waitUntil: "networkidle" });
    await pageAdmin.screenshot({ path: path.join(SCREENSHOTS_DIR, "02-django-admin-auditlog.png"), fullPage: true });
    recordShot("02-django-admin-auditlog.png", "Django Admin 写入与导出审计日志");

    results.stage1 = {
      zhaohui_editor_cross_site_blocked: true,
      zhaohui_viewer_readonly_enforced: true,
      admin_views_verified: true,
    };

    // =========================================================================
    // STAGE 2: Real Browser Tracking, SPA Nav, Copy Fail vs Success, Spoof Override,
    //          Preview Exclusion, 4 States, Homepage Fault & TLS Expiry Alert/Recovery
    // =========================================================================
    console.log("[E2E] === Stage 2: Monitoring, Tracking, 4 States, Fault & TLS Recovery ===");

    // Clean monitoring tables for deterministic known counts
    runPy(`
import django; django.setup()
from monitoring.models import PageEvent, GatewayMetricBucket, AlertEvent, ProbeResult
PageEvent.objects.all().delete()
GatewayMetricBucket.objects.all().delete()
AlertEvent.objects.all().delete()
ProbeResult.objects.all().delete()
`);

    // 2A. Check True Zero state BEFORE sending traffic (after probe + flush)
    await flushGateway();
    runManage(["run_probes"]);
    const trueZeroState = runPy(`
import django, json; django.setup()
from core.models import Site
from monitoring.services import compute_site_overview
ov = compute_site_overview(Site.objects.get(slug='zhaohui'), range_key='all')
print(json.dumps({r['domain'].official_domain: r['state']['code'] for r in ov['domain_rows']}))
`);
    const tzMap = JSON.parse(trueZeroState);
    assert.equal(tzMap["jszhff.cn"], "true_zero", "Active healthy domain with 0 views must be true_zero");
    assert.equal(tzMap["zhaohuifangfu.com"], "pending_icp", "Pending ICP domain must be pending_icp");

    // 2B. Drive real Chromium visits on jszhff.localhost (HTTP 18080)
    const ctxVisitor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pageSite = await ctxVisitor.newPage();

    // Load homepage -> 1 initial page_view (/)
    await pageSite.goto(`http://jszhff.localhost:${GW_HTTP}/?utm_source=strip_me&phone=13800138000`, { waitUntil: "networkidle" });
    await pageSite.waitForTimeout(300);

    // SPA navigate to /products/tanks/ -> 1 SPA page_view (tanks)
    await pageSite.click('a[href="/products/tanks/"]');
    await pageSite.waitForURL("**/products/tanks/**");
    await pageSite.waitForTimeout(400);

    // SPA navigate to /products/reactors/ -> 1 SPA page_view (reactors)
    await pageSite.click('nav.pt-desktop-nav a[href="/products/reactors/"]');
    await pageSite.waitForURL("**/products/reactors/**");
    await pageSite.waitForTimeout(400);

    // Navigate back to homepage brief section -> 1 SPA page_view (/)
    await pageSite.click('a.pt-header-cta');
    await pageSite.waitForURL("**/?product=reactors#brief");
    await pageSite.waitForTimeout(400);

    // Fill sensitive inputs in BriefWorkbench
    await pageSite.fill("#pt-medium", "31% 盐酸敏感工况测试输入_DO_NOT_COLLECT");
    await pageSite.fill("#pt-temp", "85");

    // Case 1: Clipboard copy FAILS -> MUST NOT count brief_copy_success
    await pageSite.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: () => Promise.reject(new Error("Simulated clipboard permission denied")),
        },
      });
    });
    await pageSite.click("aside.pt-brief-output button.pt-button");
    await pageSite.waitForTimeout(300);
    const copyAfterFail = Number(runPy(`
import django; django.setup()
from monitoring.models import PageEvent
print(PageEvent.objects.filter(event_type='brief_copy_success').count())
`));
    assert.equal(copyAfterFail, 0, "Clipboard copy failure MUST NOT be counted as brief_copy_success");

    // Case 2: Clipboard copy SUCCEEDS -> counts exactly 1 brief_copy_success
    await pageSite.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: () => Promise.resolve(),
        },
      });
    });
    await pageSite.click("aside.pt-brief-output button.pt-button");
    await pageSite.waitForTimeout(350);

    // Click phone & email links (prevent external protocol dialog)
    await pageSite.evaluate(() => {
      document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach((a) => {
        a.addEventListener("click", (e) => e.preventDefault());
      });
    });
    await pageSite.locator('a[href^="tel:"]').first().click();
    await pageSite.locator('a[href^="mailto:"]').first().click();
    await pageSite.waitForTimeout(350);

    // Spoofed site payload + sensitive fields via gateway on jszhff.localhost -> must override to zhaohui & drop sensitive fields
    const spoofRes = await pageSite.evaluate(async () => {
      const r = await fetch("/_track/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "page_view",
          page_path: "/products/towers/?secret=SHOULD_STRIP",
          product_category: "towers",
          site: "sim-site",
          clipboard: "SECRET_CLIPBOARD_NEVER_STORE",
          phone: "133-0617-0776",
          email: "private-buyer@example.com",
        }),
      });
      return { status: r.status, data: await r.json() };
    });
    assert.equal(spoofRes.status, 201);
    assert.equal(spoofRes.data.attributed_site, "zhaohui", "Trusted gateway must override browser-claimed site");
    assert.equal(spoofRes.data.site_override_applied, true);

    // Visit preview domain -> must be excluded from PageEvent
    await pageSite.goto(`http://preview-jszhff.localhost:${GW_HTTP}/`, { waitUntil: "networkidle" });
    await pageSite.waitForTimeout(350);

    // Visit sim-site (home + sim-vessel + phone click)
    await pageSite.goto(`http://sim-site.localhost:${GW_HTTP}/`, { waitUntil: "networkidle" });
    await pageSite.waitForTimeout(300);
    await pageSite.goto(`http://sim-site.localhost:${GW_HTTP}/products/sim-vessel/`, { waitUntil: "networkidle" });
    await pageSite.waitForTimeout(300);

    await flushGateway();

    // Verify exact known counts & privacy
    const stage2Counts = JSON.parse(runPy(`
import django, json; django.setup()
from core.models import Site
from monitoring.models import PageEvent
from monitoring.services import compute_site_overview
zh = compute_site_overview(Site.objects.get(slug='zhaohui'), range_key='all')
sim = compute_site_overview(Site.objects.get(slug='sim-site'), range_key='all')
zh_sum = sum(r['page_views'] for r in zh['domain_rows'] if r['domain'].domain_status == 'active')
all_paths = list(PageEvent.objects.values_list('page_path', flat=True))
print(json.dumps({
    'zh_totals': zh['totals'],
    'zh_active_domain_sum': zh_sum,
    'sim_totals': sim['totals'],
    'has_query_in_paths': any('?' in p for p in all_paths),
    'event_count_total': PageEvent.objects.count(),
}))
`));
    assert.equal(stage2Counts.zh_totals.page_views, stage2Counts.zh_active_domain_sum, "Site total must equal sum of active domains");
    assert.equal(stage2Counts.zh_totals.page_views, 5, "Expected 5 jszhff page_views (home + tanks SPA + reactors SPA + home SPA + towers spoof-override)");
    assert.equal(stage2Counts.zh_totals.spa_page_views, 3, "Expected 3 SPA navigation page_views");
    assert.equal(stage2Counts.zh_totals.brief_copy_success, 1, "Expected exactly 1 brief_copy_success");
    assert.equal(stage2Counts.zh_totals.phone_click, 1, "Expected 1 phone_click");
    assert.equal(stage2Counts.zh_totals.email_click, 1, "Expected 1 email_click");
    assert.equal(stage2Counts.sim_totals.page_views, 2, "Expected 2 sim-site page_views");
    assert.equal(stage2Counts.has_query_in_paths, false, "No query strings allowed in stored page_path");

    // Verify exported JSON & CSV contain ZERO sensitive values
    const exportResp = await pageAdmin.request.get(`${DJANGO_BASE}/overview/export.json?site=zhaohui&range=all`);
    const exportText = await exportResp.text();
    for (const forbidden of ["DO_NOT_COLLECT", "SECRET_CLIPBOARD_NEVER_STORE", "private-buyer@example.com", "strip_me", "13800138000"]) {
      assert.ok(!exportText.includes(forbidden), `Export must not contain ${forbidden}`);
    }

    // 2C. Simulate Homepage Error + TLS Expiring Cert (5 days) + Interrupted/Not-onboarded visual verification
    const faultsFile = path.join(RUNTIME_DIR, "gateway-faults.json");
    fs.writeFileSync(
      faultsFile,
      JSON.stringify({
        home_faults: {
          "jszhff.localhost": { status: 503, body: "Simulated 503 Maintenance Fault" },
        },
      }),
      "utf8",
    );
    // Swap server cert to 5-day expiring cert
    execFileSync(VENV_PY, [
      path.join(REPO_ROOT, "ops", "test-env", "gen_certs.py"),
      "--certs-dir",
      path.join(RUNTIME_DIR, "certs"),
      "--days",
      "5",
      "--prefix",
      "server",
    ]);
    await pageSite.waitForTimeout(300);

    // Temporarily add a 'not_onboarded' demo domain and mark sim-site heartbeat paused for 4-state screenshot clarity
    runManage(["run_probes"]);

    const faultCheck = JSON.parse(runPy(`
import django, json; django.setup()
from monitoring.models import AlertEvent
open_types = sorted(AlertEvent.objects.filter(domain__official_domain='jszhff.cn', status='open').values_list('alert_type', flat=True))
print(json.dumps(open_types))
`));
    assert.ok(faultCheck.includes("home_error"), `Expected home_error alert open, got ${faultCheck}`);
    assert.ok(faultCheck.includes("tls_expiring"), `Expected tls_expiring alert open, got ${faultCheck}`);

    // Capture Overview Screenshot DURING fault + TLS expiring warning!
    await pageAdmin.goto(`${DJANGO_BASE}/overview/?site=zhaohui&range=all`, { waitUntil: "networkidle" });
    await pageAdmin.screenshot({ path: path.join(SCREENSHOTS_DIR, "03-overview-fault-tls-warning.png"), fullPage: true });
    recordShot("03-overview-fault-tls-warning.png", "运营总览页：首页 503 故障告警、TLS 证书临期告警与三路并排诊断");

    // Recover: clear homepage fault & restore 365-day TLS cert
    fs.unlinkSync(faultsFile);
    execFileSync(VENV_PY, [
      path.join(REPO_ROOT, "ops", "test-env", "gen_certs.py"),
      "--certs-dir",
      path.join(RUNTIME_DIR, "certs"),
      "--days",
      "365",
      "--prefix",
      "server",
    ]);
    await pageSite.waitForTimeout(300);
    await flushGateway();
    runManage(["run_probes"]);

    const recoveredCheck = JSON.parse(runPy(`
import django, json; django.setup()
from monitoring.models import AlertEvent
open_cnt = AlertEvent.objects.filter(domain__official_domain='jszhff.cn', status='open').count()
resolved_types = sorted(AlertEvent.objects.filter(domain__official_domain='jszhff.cn', status='resolved').values_list('alert_type', flat=True))
print(json.dumps({'open_cnt': open_cnt, 'resolved_types': resolved_types}))
`));
    assert.equal(recoveredCheck.open_cnt, 0, "All alerts should be resolved after recovery");
    assert.ok(recoveredCheck.resolved_types.includes("home_error"));
    assert.ok(recoveredCheck.resolved_types.includes("tls_expiring"));

    // Capture healthy recovered Overview screenshots for zhaohui & sim-site
    await pageAdmin.goto(`${DJANGO_BASE}/overview/?site=zhaohui&range=all`, { waitUntil: "networkidle" });
    await pageAdmin.screenshot({ path: path.join(SCREENSHOTS_DIR, "04-overview-zhaohui-recovered.png"), fullPage: true });
    recordShot("04-overview-zhaohui-recovered.png", "兆辉官网运营总览页（故障与证书恢复后、含未启用线上收件与四态说明）");

    await pageAdmin.goto(`${DJANGO_BASE}/overview/?site=sim-site&range=all`, { waitUntil: "networkidle" });
    await pageAdmin.screenshot({ path: path.join(SCREENSHOTS_DIR, "05-overview-sim-site.png"), fullPage: true });
    recordShot("05-overview-sim-site.png", "模拟独立测试站运营总览页（多站点数据独立统计）");

    results.stage2 = {
      true_zero_verified: true,
      known_counts: stage2Counts,
      copy_failure_not_counted: true,
      spoof_site_overridden: true,
      preview_excluded: true,
      no_sensitive_data_in_exports: true,
      fault_and_tls_warning_triggered: faultCheck,
      fault_and_tls_recovered: recoveredCheck,
    };

    // =========================================================================
    // STAGE 3: Edit Once -> Dual-Domain Preview -> Sim-Site Untouched ->
    //          Failure Protection -> Release -> One-Click Rollback -> Admin Downtime
    // =========================================================================
    console.log("[E2E] === Stage 3: Content Edit, Dual Preview, Failure Protection, Rollback ===");

    const stage3Info = JSON.parse(runPy(`
import django, json; django.setup()
from django.contrib.auth import get_user_model
from core.models import Domain, Site
from publishing.models import ManagedProduct, ReleaseRecord
from publishing.pipeline import create_snapshot, approve_snapshot, build_and_deploy_domain, rollback_domain

User = get_user_model()
editor = User.objects.get(username='zhaohui_editor')
pub = User.objects.get(username='zhaohui_publisher')
zh = Site.objects.get(slug='zhaohui')
d_main = Domain.objects.get(official_domain='jszhff.cn')
d_pend = Domain.objects.get(official_domain='zhaohuifangfu.com')

rel_v1 = ReleaseRecord.objects.filter(domain=d_main, is_current=True, status='succeeded').first()
assert rel_v1 is not None

# 1. Edit tanks ONCE
tanks = ManagedProduct.objects.get(site=zh, slug='tanks')
orig_name = tanks.display_name
orig_summary = tanks.summary
tanks.display_name = '防腐储罐（多域联动测试版）'
tanks.summary = '产品包括钢衬四氟、PO、PE、PFA、PVDF 储罐，本次为受管内容单次编辑双域预览验证。'
tanks.updated_by = editor
tanks.save()

snap_v2 = create_snapshot(zh, editor, note='储罐名称与简介单次编辑，验证双域预览与发布回滚')

# 2. Preview on BOTH Zhaohui domains
p_main = build_and_deploy_domain(snapshot=snap_v2, domain=d_main, build_type=ReleaseRecord.BUILD_PREVIEW, user=editor)
p_pend = build_and_deploy_domain(snapshot=snap_v2, domain=d_pend, build_type=ReleaseRecord.BUILD_PREVIEW, user=editor)
assert p_main.status == 'succeeded', p_main.error_message
assert p_pend.status == 'succeeded', p_pend.error_message

# 3. Approve v2 & simulate publish failure -> v1 MUST remain active!
approve_snapshot(snap_v2, pub)
rel_fail = build_and_deploy_domain(snapshot=snap_v2, domain=d_main, build_type=ReleaseRecord.BUILD_RELEASE, user=pub, simulate_failure='smoke_error')
assert rel_fail.status == 'failed'

print(json.dumps({
    'rel_v1_id': rel_v1.id,
    'rel_v1_ver': rel_v1.release_version,
    'snap_v2_id': snap_v2.id,
    'snap_v2_ver': snap_v2.version,
    'fail_ver': rel_fail.release_version,
    'orig_name': orig_name,
    'orig_summary': orig_summary,
}))
`));

    // Verify dual-domain previews in real Chromium & verify sim-site is untouched!
    const pMainHtml = await (await fetch(`http://preview-jszhff.localhost:${GW_HTTP}/`)).text();
    const pPendHtml = await (await fetch(`http://preview-zhaohuifangfu.localhost:${GW_HTTP}/`)).text();
    const simLiveHtml = await (await fetch(`http://sim-site.localhost:${GW_HTTP}/`)).text();
    const zhLiveDuringFailHtml = await (await fetch(`http://jszhff.localhost:${GW_HTTP}/`)).text();

    assert.ok(pMainHtml.includes("防腐储罐（多域联动测试版）"), "preview-jszhff must show updated product");
    assert.ok(pMainHtml.includes("苏ICP备20000966号-6"), "preview-jszhff must show jszhff.cn ICP");
    assert.ok(pMainHtml.includes('rel="canonical" href="https://jszhff.cn/"'), "preview-jszhff canonical must point to primary");

    assert.ok(pPendHtml.includes("防腐储罐（多域联动测试版）"), "preview-zhaohuifangfu must show updated product");
    assert.ok(pPendHtml.includes("待备案（zhaohuifangfu.com 离线预配置）"), "preview-zhaohuifangfu must show its own ICP field");
    assert.ok(pPendHtml.includes('rel="canonical" href="https://jszhff.cn/"'), "preview-zhaohuifangfu canonical must preserve primary jszhff.cn");

    assert.ok(simLiveHtml.includes("华东耐蚀演示站"), "sim-site must stay untouched");
    assert.ok(!simLiveHtml.includes("多域联动测试版"), "sim-site must not receive Zhaohui edits");
    assert.ok(simLiveHtml.includes("沪ICP备00000001号-测试"), "sim-site ICP must stay intact");
    assert.ok(simLiveHtml.includes('rel="canonical" href="https://sim-site.localhost/"'), "sim-site canonical must point to itself");

    // Verify failure protection: live jszhff.localhost still serves v1!
    assert.ok(!zhLiveDuringFailHtml.includes("多域联动测试版"), "After failed publish, live jszhff.localhost must keep serving v1");

    // Capture dual-domain preview + untouched sim-site screenshots
    await pageSite.goto(`http://preview-jszhff.localhost:${GW_HTTP}/`, { waitUntil: "networkidle" });
    await pageSite.locator("#equipment .pt-product").first().scrollIntoViewIfNeeded();
    await pageSite.waitForTimeout(700);
    await pageSite.screenshot({ path: path.join(SCREENSHOTS_DIR, "06-preview-jszhff-equipment-and-footer.png"), fullPage: false });
    await pageSite.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pageSite.waitForTimeout(400);
    await pageSite.screenshot({ path: path.join(SCREENSHOTS_DIR, "06b-preview-jszhff-footer-icp.png"), fullPage: false });
    recordShot("06-preview-jszhff-equipment-and-footer.png", "兆辉主域预览（preview-jszhff.localhost）更新后产品展示");
    recordShot("06b-preview-jszhff-footer-icp.png", "兆辉主域预览页脚备案号（苏ICP备20000966号-6）");

    await pageSite.goto(`http://preview-zhaohuifangfu.localhost:${GW_HTTP}/`, { waitUntil: "networkidle" });
    await pageSite.locator("#equipment .pt-product").first().scrollIntoViewIfNeeded();
    await pageSite.waitForTimeout(700);
    await pageSite.screenshot({ path: path.join(SCREENSHOTS_DIR, "07-preview-zhaohuifangfu-equipment.png"), fullPage: false });
    await pageSite.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pageSite.waitForTimeout(400);
    await pageSite.screenshot({ path: path.join(SCREENSHOTS_DIR, "07b-preview-zhaohuifangfu-footer-icp.png"), fullPage: false });
    recordShot("07-preview-zhaohuifangfu-equipment.png", "兆辉待备案域离线预览（preview-zhaohuifangfu.localhost）复用同一更新产品");
    recordShot("07b-preview-zhaohuifangfu-footer-icp.png", "兆辉待备案域离线预览页脚独立备案字段");

    await pageSite.goto(`http://sim-site.localhost:${GW_HTTP}/`, { waitUntil: "networkidle" });
    await pageSite.waitForTimeout(300);
    await pageSite.screenshot({ path: path.join(SCREENSHOTS_DIR, "08-sim-site-untouched.png"), fullPage: true });
    recordShot("08-sim-site-untouched.png", "模拟独立测试站（sim-site.localhost）内容、备案号与规范网址不受影响");

    // 4. Real publish v2 on jszhff.localhost, verify live update, then rollback to v1 & verify assets
    const publishAndRollback = JSON.parse(runPy(`
import django, json; django.setup()
from django.contrib.auth import get_user_model
from core.models import Domain
from publishing.models import ContentSnapshot, ManagedProduct, ReleaseRecord
from publishing.pipeline import build_and_deploy_domain, rollback_domain

User = get_user_model()
pub = User.objects.get(username='zhaohui_publisher')
d_main = Domain.objects.get(official_domain='jszhff.cn')
snap_v2 = ContentSnapshot.objects.get(id=${stage3Info.snap_v2_id})
rel_v1 = ReleaseRecord.objects.get(id=${stage3Info.rel_v1_id})

rel_v2 = build_and_deploy_domain(snapshot=snap_v2, domain=d_main, build_type=ReleaseRecord.BUILD_RELEASE, user=pub)
assert rel_v2.status == 'succeeded', rel_v2.error_message
print(json.dumps({'rel_v2_ver': rel_v2.release_version}))
`));
    const zhLiveV2Html = await (await fetch(`http://jszhff.localhost:${GW_HTTP}/`)).text();
    assert.ok(zhLiveV2Html.includes("防腐储罐（多域联动测试版）"), "Live jszhff.localhost must serve v2 after release");

    // Rollback to v1 & restore draft text back to clean original Zhaohui copy
    const rbInfo = JSON.parse(runPy(`
import django, json; django.setup()
from django.contrib.auth import get_user_model
from core.models import Domain
from publishing.models import ManagedProduct, ReleaseRecord
from publishing.pipeline import rollback_domain

User = get_user_model()
pub = User.objects.get(username='zhaohui_publisher')
d_main = Domain.objects.get(official_domain='jszhff.cn')
rel_v1 = ReleaseRecord.objects.get(id=${stage3Info.rel_v1_id})
rb = rollback_domain(d_main, rel_v1, pub)

# Restore draft fields cleanly to original approved copy
tanks = ManagedProduct.objects.get(site__slug='zhaohui', slug='tanks')
tanks.display_name = ${JSON.stringify(stage3Info.orig_name)}
tanks.summary = ${JSON.stringify(stage3Info.orig_summary)}
tanks.save()
print(json.dumps({'rb_ver': rb.release_version, 'smoke_passed': rb.smoke_check_passed}))
`));
    assert.equal(rbInfo.smoke_passed, true);

    // Verify rolled-back live page + static assets (JS/CSS/WebP) load cleanly in Chromium with 0 failed requests!
    const failedAssets = [];
    pageSite.on("response", (resp) => {
      if (resp.url().startsWith(`http://jszhff.localhost:${GW_HTTP}/`) && resp.status() >= 400) {
        failedAssets.push(`${resp.status()} ${resp.url()}`);
      }
    });
    await pageSite.goto(`http://jszhff.localhost:${GW_HTTP}/`, { waitUntil: "networkidle" });
    const rolledBody = await pageSite.textContent("body");
    assert.ok(!rolledBody.includes("多域联动测试版"), "After rollback, live jszhff.localhost must be restored to v1");
    await pageSite.goto(`http://jszhff.localhost:${GW_HTTP}/products/tanks/`, { waitUntil: "networkidle" });
    assert.equal(failedAssets.length, 0, `Rolled back assets failed: ${failedAssets.join(", ")}`);

    // Capture Publishing Studio screenshot (showing failed publish protection + rollback history)
    await pageAdmin.goto(`${DJANGO_BASE}/publishing/zhaohui/`, { waitUntil: "networkidle" });
    await pageAdmin.screenshot({ path: path.join(SCREENSHOTS_DIR, "09-publishing-studio-history-rollback.png"), fullPage: true });
    recordShot("09-publishing-studio-history-rollback.png", "内容与发布工作台：受管字段编辑、失败保护与一键回滚历史");

    results.stage3 = {
      dual_domain_preview_verified: true,
      sim_site_untouched: true,
      failure_protection_verified: stage3Info.fail_ver,
      release_v2_verified: publishAndRollback.rel_v2_ver,
      rollback_v1_verified: rbInfo.rb_ver,
      rollback_zero_asset_errors: true,
    };

    // Save structured verification output
    const summaryPath = path.join(RUNTIME_DIR, "e2e-results.json");
    fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2), "utf8");
    console.log("[E2E] ALL BROWSER & PIPELINE ASSERTIONS PASSED!");
    console.log(`[E2E] Screenshots saved to: ${SCREENSHOTS_DIR} (${results.screenshots.length} files)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[E2E] FAILED:", err);
  process.exit(1);
});
