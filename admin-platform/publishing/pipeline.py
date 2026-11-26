import fcntl
import html
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.utils import timezone
from core.models import Domain, Site, SiteMembership
from core.permissions import record_audit, require_site_role
from .models import ApprovedAsset, ContentSnapshot, ManagedContact, ManagedProduct, ReleaseRecord


class BuildPipelineError(RuntimeError):
    pass


def _atomic_symlink(link_path: Path, target_path: Path):
    link_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_link = link_path.parent / f".{link_path.name}.tmp.{os.getpid()}"
    if tmp_link.exists() or tmp_link.is_symlink():
        tmp_link.unlink()
    os.symlink(str(target_path), str(tmp_link))
    os.replace(str(tmp_link), str(link_path))


def build_snapshot_payload(site: Site) -> dict:
    products = []
    for prod in site.managed_products.select_related("approved_asset").order_by("display_order", "id"):
        products.append(
            {
                "slug": prod.slug,
                "display_order": prod.display_order,
                "title": prod.display_name,
                "summary": prod.summary,
                "image": prod.approved_asset.image_path,
                "imageAlt": prod.approved_asset.image_alt,
                "assetCode": prod.approved_asset.code,
            }
        )
    contact_obj = getattr(site, "managed_contact", None)
    contact = (
        {
            "phones": contact_obj.phones_json,
            "email": {
                "display": contact_obj.email_display,
                "href": contact_obj.email_href,
            },
            "addresses": contact_obj.addresses_json,
        }
        if contact_obj
        else {"phones": [], "email": {"display": "", "href": ""}, "addresses": []}
    )
    return {
        "schemaVersion": "1.0",
        "site": {
            "slug": site.slug,
            "name": site.name,
            "brandName": site.brand_name,
            "adapterType": site.adapter_type,
        },
        "products": products,
        "contact": contact,
    }


def create_snapshot(site: Site, user, note: str = "", request=None) -> ContentSnapshot:
    require_site_role(user, site, SiteMembership.ROLE_EDITOR)
    payload = build_snapshot_payload(site)
    checksum = ContentSnapshot.compute_checksum(payload)
    now = timezone.now()
    seq = site.snapshots.count() + 1
    version = f"v{now:%Y%m%d}-{seq:03d}"
    while ContentSnapshot.objects.filter(site=site, version=version).exists():
        seq += 1
        version = f"v{now:%Y%m%d}-{seq:03d}"

    snap = ContentSnapshot.objects.create(
        site=site,
        version=version,
        status=ContentSnapshot.STATUS_DRAFT,
        payload=payload,
        checksum=checksum,
        note=note or "保存受管内容快照",
        created_by=user,
    )
    record_audit(
        actor=user,
        action="snapshot.create",
        target_type="content_snapshot",
        target_id=str(snap.id),
        summary=f"创建内容快照 {site.slug}@{version}（checksum {checksum[:12]}）",
        site=site,
        metadata={"version": version, "checksum": checksum, "note": snap.note},
        request=request,
    )
    return snap


def approve_snapshot(snapshot: ContentSnapshot, user, request=None) -> ContentSnapshot:
    require_site_role(user, snapshot.site, SiteMembership.ROLE_PUBLISHER)
    snapshot.status = ContentSnapshot.STATUS_APPROVED
    snapshot.approved_by = user
    snapshot.approved_at = timezone.now()
    snapshot.save(update_fields=["status", "approved_by", "approved_at"])
    record_audit(
        actor=user,
        action="snapshot.approve",
        target_type="content_snapshot",
        target_id=str(snapshot.id),
        summary=f"审核通过内容快照 {snapshot.site.slug}@{snapshot.version}",
        site=snapshot.site,
        metadata={"version": snapshot.version, "checksum": snapshot.checksum},
        request=request,
    )
    return snapshot


def build_domain_snapshot_doc(snapshot: ContentSnapshot, domain: Domain, build_type: str) -> dict:
    doc = json.loads(json.dumps(snapshot.payload))
    doc["version"] = snapshot.version
    doc["checksum"] = snapshot.checksum
    doc["buildType"] = build_type
    doc["domain"] = {
        "officialDomain": domain.official_domain,
        "testHost": domain.test_host,
        "previewHost": domain.preview_host,
        "isPrimary": domain.is_primary,
        "icpNumber": domain.icp_number,
        "domainStatus": domain.domain_status,
        "publicEnabled": domain.public_enabled,
        "canonicalPolicy": domain.canonical_policy,
        "canonicalBase": domain.get_canonical_base(),
    }
    return doc


def _build_nextjs_site(snapshot_json_path: Path, artifact_dir: Path):
    lock_file = settings.RUNTIME_DIR / "next-build.lock"
    lock_file.parent.mkdir(parents=True, exist_ok=True)
    with open(lock_file, "w") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            env = os.environ.copy()
            env["ZHAOHUI_SNAPSHOT_PATH"] = str(snapshot_json_path)
            env["NEXT_TELEMETRY_DISABLED"] = "1"
            out_dir = settings.REPO_ROOT / "out"
            if out_dir.exists():
                shutil.rmtree(out_dir)
            proc = subprocess.run(
                ["npm", "run", "build"],
                cwd=str(settings.REPO_ROOT),
                env=env,
                capture_output=True,
                text=True,
                timeout=180,
            )
            if proc.returncode != 0:
                tail = (proc.stderr or proc.stdout or "")[-1200:]
                raise BuildPipelineError(f"Next.js 静态构建失败 (exit={proc.returncode}): {tail}")
            if not (out_dir / "index.html").is_file():
                raise BuildPipelineError("Next.js 静态导出缺少 out/index.html")
            if artifact_dir.exists():
                shutil.rmtree(artifact_dir)
            shutil.copytree(out_dir, artifact_dir)
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)


def _render_sim_site(domain_doc: dict, artifact_dir: Path):
    """Independent static site adapter for sim-site (demonstrating multi-site isolation)."""
    if artifact_dir.exists():
        shutil.rmtree(artifact_dir)
    (artifact_dir / "assets").mkdir(parents=True, exist_ok=True)

    # Copy approved placeholder images from public/images/site if referenced
    pub_root = settings.REPO_ROOT / "public"
    for prod in domain_doc["products"]:
        rel_img = prod["image"].lstrip("/")
        src = pub_root / rel_img
        if src.is_file():
            dst = artifact_dir / rel_img
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)

    site_name = html.escape(domain_doc["site"]["brandName"])
    icp = html.escape(domain_doc["domain"]["icpNumber"])
    canonical_base = domain_doc["domain"]["canonicalBase"].rstrip("/")
    contact = domain_doc["contact"]
    phones = contact.get("phones", [])
    email = contact.get("email", {"display": "", "href": ""})
    addresses = contact.get("addresses", [])
    version_tag = html.escape(domain_doc["version"])

    css = """
:root { --bg: #0c1218; --paper: #f1efe9; --ink: #111518; --accent: #c92a2a; --line: rgba(17,21,24,.16); }
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif; background: var(--paper); color: var(--ink); line-height: 1.7; font-size: 15px; }
header { background: var(--bg); color: #f4f5f6; padding: 18px 32px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,.14); }
header a { color: #f4f5f6; text-decoration: none; margin-left: 20px; font-size: 15px; }
main { max-width: 1120px; margin: 0 auto; padding: 48px 24px; }
.badge { display: inline-block; border: 1px solid var(--accent); color: var(--accent); padding: 2px 10px; font-size: 14px; margin-bottom: 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-top: 28px; }
.card { border: 1px solid var(--line); background: #fff; padding: 20px; }
.card img { width: 100%; height: 200px; object-fit: cover; display: block; margin-bottom: 14px; }
.btn { display: inline-block; background: var(--accent); color: #fff; padding: 10px 18px; text-decoration: none; border: 0; cursor: pointer; font-size: 15px; }
.contact-box { margin-top: 40px; border-top: 1px solid var(--line); padding-top: 24px; }
footer { background: var(--bg); color: rgba(244,245,246,.76); padding: 28px 32px; font-size: 14px; margin-top: 48px; }
footer a { color: #fff; }
""".strip()
    (artifact_dir / "assets" / "site.css").write_text(css, encoding="utf-8")

    tracker_js = """
(function() {
  function send(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/_track/event', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/_track/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
      }
    } catch (e) {}
  }
  function getCategory(p) {
    var m = p.match(/^\\/products\\/([a-z0-9_-]+)\\/?$/);
    return m ? m[1] : '';
  }
  var path = window.location.pathname || '/';
  send({ event_type: 'page_view', page_path: path, product_category: getCategory(path), is_spa_navigation: false });
  document.addEventListener('click', function(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) {
      send({ event_type: 'phone_click', page_path: path, product_category: getCategory(path) });
    } else if (href.indexOf('mailto:') === 0) {
      send({ event_type: 'email_click', page_path: path, product_category: getCategory(path) });
    }
  });
  var copyBtn = document.getElementById('sim-copy-brief');
  if (copyBtn) {
    copyBtn.addEventListener('click', function() {
      var text = document.getElementById('sim-brief-text').textContent || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
          copyBtn.textContent = '已复制';
          send({ event_type: 'brief_copy_success', page_path: path, product_category: getCategory(path) });
        }).catch(function() {
          copyBtn.textContent = '复制失败';
        });
      }
    });
  }
})();
""".strip()
    (artifact_dir / "assets" / "tracker.js").write_text(tracker_js, encoding="utf-8")

    phones_html = " / ".join(
        f'<a href="{html.escape(p["href"])}">{html.escape(p["display"])}</a>' for p in phones
    )
    addr_html = " · ".join(
        f'{html.escape(a["region"])}：{html.escape(a["address"])}' for a in addresses
    )
    email_html = f'<a href="{html.escape(email["href"])}">{html.escape(email["display"])}</a>'

    cards = []
    for prod in domain_doc["products"]:
        cards.append(
            f"""
            <article class="card">
              <img src="{html.escape(prod['image'])}" alt="{html.escape(prod['imageAlt'])}" />
              <h2>{html.escape(prod['title'])}</h2>
              <p>{html.escape(prod['summary'])}</p>
              <a class="btn" href="/products/{html.escape(prod['slug'])}/">查看产品详情</a>
            </article>
            """
        )

    nav_links = "".join(
        f'<a href="/products/{html.escape(p["slug"])}/">{html.escape(p["title"])}</a>'
        for p in domain_doc["products"]
    )

    home_html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{site_name} | 独立站点内容隔离验证</title>
  <link rel="canonical" href="{html.escape(canonical_base)}/" />
  <link rel="stylesheet" href="/assets/site.css" />
</head>
<body>
  <header>
    <strong>{site_name}</strong>
    <nav><a href="/">首页</a>{nav_links}</nav>
  </header>
  <main>
    <span class="badge">独立测试站点 · 快照 {version_tag}</span>
    <h1>{site_name}</h1>
    <p>本站点用于验证多站点数据隔离、独立备案号、自身规范网址与独立内容发布流水线，与兆辉官网数据完全隔离。</p>
    <section class="grid">{''.join(cards)}</section>
    <section class="contact-box">
      <h2>公开联系方式与工况简报</h2>
      <p>电话：{phones_html}</p>
      <p>邮箱：{email_html}</p>
      <p>地址：{addr_html}</p>
      <pre id="sim-brief-text" style="background:#0c1218;color:#f1f2f2;padding:16px;">{site_name} · 测试工况简报（不采集正文）</pre>
      <button type="button" class="btn" id="sim-copy-brief">复制简报</button>
    </section>
  </main>
  <footer>
    <div>© 2026 {site_name} · <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{icp}</a></div>
  </footer>
  <script src="/assets/tracker.js" defer></script>
</body>
</html>
"""
    (artifact_dir / "index.html").write_text(home_html, encoding="utf-8")

    for prod in domain_doc["products"]:
        p_dir = artifact_dir / "products" / prod["slug"]
        p_dir.mkdir(parents=True, exist_ok=True)
        p_html = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html.escape(prod['title'])} | {site_name}</title>
  <link rel="canonical" href="{html.escape(canonical_base)}/products/{html.escape(prod['slug'])}/" />
  <link rel="stylesheet" href="/assets/site.css" />
</head>
<body>
  <header>
    <strong>{site_name}</strong>
    <nav><a href="/">首页</a>{nav_links}</nav>
  </header>
  <main>
    <span class="badge">独立站点产品详情 · {version_tag}</span>
    <h1>{html.escape(prod['title'])}</h1>
    <img src="{html.escape(prod['image'])}" alt="{html.escape(prod['imageAlt'])}" style="max-width:640px;width:100%;height:auto;" />
    <p>{html.escape(prod['summary'])}</p>
    <p><a class="btn" href="/">返回首页</a></p>
  </main>
  <footer>
    <div>© 2026 {site_name} · <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{icp}</a></div>
  </footer>
  <script src="/assets/tracker.js" defer></script>
</body>
</html>
"""
        (p_dir / "index.html").write_text(p_html, encoding="utf-8")


def verify_static_artifact(artifact_dir: Path, domain_doc: dict, simulate_failure: str | None = None) -> tuple[bool, dict]:
    checks = []
    errors = []

    if simulate_failure == "smoke_error":
        return False, {
            "passed": False,
            "checks": [{"name": "simulated_smoke_gate", "ok": False}],
            "errors": ["模拟冒烟验证失败：首页核心内容或静态资源校验未通过，已中止版本切换。"],
        }

    index_file = artifact_dir / "index.html"
    if not index_file.is_file():
        errors.append("缺少首页 index.html")
        return False, {"passed": False, "checks": checks, "errors": errors}

    home_html = index_file.read_text(encoding="utf-8", errors="ignore")
    icp = domain_doc["domain"]["icpNumber"]
    canonical_base = domain_doc["domain"]["canonicalBase"].rstrip("/")

    icp_ok = (not icp) or (icp in home_html)
    checks.append({"name": "home_icp_present", "ok": icp_ok, "expected": icp})
    if not icp_ok:
        errors.append(f"首页未包含预期备案号：{icp}")

    canonical_ok = f'rel="canonical" href="{canonical_base}/"' in home_html or f'rel="canonical" href="{canonical_base}"' in home_html
    checks.append({"name": "home_canonical_match", "ok": canonical_ok, "expected": f"{canonical_base}/"})
    if not canonical_ok:
        errors.append(f"首页规范网址 canonical 未匹配预期：{canonical_base}/")

    # Verify all products exist & display_name present
    for prod in domain_doc["products"]:
        p_file = artifact_dir / "products" / prod["slug"] / "index.html"
        exists = p_file.is_file()
        title_ok = False
        p_canonical_ok = False
        if exists:
            p_html = p_file.read_text(encoding="utf-8", errors="ignore")
            title_ok = prod["title"] in p_html and prod["title"] in home_html
            expected_p_can = f'{canonical_base}/products/{prod["slug"]}/'
            p_canonical_ok = f'rel="canonical" href="{expected_p_can}"' in p_html
        checks.append(
            {
                "name": f"product_{prod['slug']}",
                "ok": exists and title_ok and p_canonical_ok,
                "exists": exists,
                "title_ok": title_ok,
                "canonical_ok": p_canonical_ok,
            }
        )
        if not (exists and title_ok and p_canonical_ok):
            errors.append(f"产品页 {prod['slug']} 冒烟校验未通过（exists={exists}, title_ok={title_ok}, canonical_ok={p_canonical_ok}）")

    # Verify referenced local static assets exist on disk (JS/CSS/images)
    asset_refs = set(
        re.findall(r'(?:src|href)="(/[^\s"?#]+\.(?:css|js|webp|png|jpg|jpeg|svg|ico))"', home_html)
    )
    missing_assets = [ref for ref in sorted(asset_refs) if not (artifact_dir / ref.lstrip("/")).is_file()]
    assets_ok = len(missing_assets) == 0 and len(asset_refs) > 0
    checks.append({"name": "referenced_static_assets", "ok": assets_ok, "checked_count": len(asset_refs), "missing": missing_assets[:10]})
    if not assets_ok:
        errors.append(f"静态资源缺失或为空：{missing_assets[:5]}")

    passed = len(errors) == 0
    return passed, {"passed": passed, "checks": checks, "errors": errors}


def build_and_deploy_domain(
    *,
    snapshot: ContentSnapshot,
    domain: Domain,
    build_type: str,
    user,
    request=None,
    simulate_failure: str | None = None,
) -> ReleaseRecord:
    if domain.site_id != snapshot.site_id:
        raise PermissionDenied("目标域名与快照所属站点不匹配。")

    if build_type == ReleaseRecord.BUILD_PREVIEW:
        require_site_role(user, snapshot.site, SiteMembership.ROLE_EDITOR)
    elif build_type == ReleaseRecord.BUILD_RELEASE:
        require_site_role(user, snapshot.site, SiteMembership.ROLE_PUBLISHER)
        if snapshot.status not in (ContentSnapshot.STATUS_APPROVED, ContentSnapshot.STATUS_PUBLISHED):
            raise BuildPipelineError("正式发布前必须先完成版本审核（状态须为「已审核」）。")
    else:
        raise BuildPipelineError(f"不支持的构建类型：{build_type}")

    now = timezone.now()
    seq = ReleaseRecord.objects.filter(domain=domain).count() + 1
    rel_ver = f"{build_type}-{snapshot.version}-{seq:03d}"

    release = ReleaseRecord.objects.create(
        site=snapshot.site,
        domain=domain,
        snapshot=snapshot,
        release_version=rel_ver,
        build_type=build_type,
        status=ReleaseRecord.STATUS_BUILDING,
        triggered_by=user,
    )

    domain_doc = build_domain_snapshot_doc(snapshot, domain, build_type)
    snap_dir = settings.SNAPSHOTS_ROOT / snapshot.site.slug
    snap_dir.mkdir(parents=True, exist_ok=True)
    snap_file = snap_dir / f"{rel_ver}-{domain.test_host}.json"
    snap_file.write_text(json.dumps(domain_doc, ensure_ascii=False, indent=2), encoding="utf-8")

    site_domain_root = settings.SITES_ROOT / domain.test_host
    if build_type == ReleaseRecord.BUILD_PREVIEW:
        artifact_dir = site_domain_root / "previews" / rel_ver
    else:
        artifact_dir = site_domain_root / "releases" / rel_ver

    try:
        if simulate_failure == "build_error":
            raise BuildPipelineError("模拟静态构建失败：构建阶段主动中止，线上当前版本不受影响。")

        if snapshot.site.adapter_type == Site.ADAPTER_NEXTJS_ZHAOHUI:
            _build_nextjs_site(snap_file, artifact_dir)
        else:
            _render_sim_site(domain_doc, artifact_dir)

        passed, report = verify_static_artifact(artifact_dir, domain_doc, simulate_failure=simulate_failure)
        release.artifact_dir = str(artifact_dir)
        release.smoke_check_passed = passed
        release.smoke_check_report = report

        if not passed:
            release.status = ReleaseRecord.STATUS_FAILED
            release.error_message = "；".join(report.get("errors", ["冒烟验证未通过"]))
            release.finished_at = timezone.now()
            release.save()
            record_audit(
                actor=user,
                action="release.publish_failed",
                target_type="release_record",
                target_id=str(release.id),
                summary=f"{domain.official_domain} {rel_ver} 冒烟验证失败，已保留原生效版本",
                site=snapshot.site,
                metadata={"domain": domain.official_domain, "errors": report.get("errors", [])},
                request=request,
            )
            return release

        if build_type == ReleaseRecord.BUILD_PREVIEW:
            _atomic_symlink(site_domain_root / "preview", artifact_dir)
            if snapshot.status == ContentSnapshot.STATUS_DRAFT:
                snapshot.status = ContentSnapshot.STATUS_PREVIEWED
                snapshot.save(update_fields=["status"])
            release.status = ReleaseRecord.STATUS_SUCCEEDED
            release.finished_at = timezone.now()
            release.save()
            record_audit(
                actor=user,
                action="release.preview",
                target_type="release_record",
                target_id=str(release.id),
                summary=f"生成预览 {domain.preview_host} ({rel_ver})",
                site=snapshot.site,
                metadata={"domain": domain.official_domain, "preview_host": domain.preview_host, "snapshot": snapshot.version},
                request=request,
            )
        else:
            _atomic_symlink(site_domain_root / "current", artifact_dir)
            ReleaseRecord.objects.filter(domain=domain, is_current=True).update(is_current=False)
            release.status = ReleaseRecord.STATUS_SUCCEEDED
            release.is_current = True
            release.finished_at = timezone.now()
            release.save()
            snapshot.status = ContentSnapshot.STATUS_PUBLISHED
            snapshot.save(update_fields=["status"])
            record_audit(
                actor=user,
                action="release.publish",
                target_type="release_record",
                target_id=str(release.id),
                summary=f"正式发布并原子切换 {domain.official_domain} -> {rel_ver}",
                site=snapshot.site,
                metadata={"domain": domain.official_domain, "snapshot": snapshot.version, "artifact_dir": str(artifact_dir)},
                request=request,
            )
        return release
    except Exception as exc:
        release.status = ReleaseRecord.STATUS_FAILED
        release.error_message = str(exc)
        release.finished_at = timezone.now()
        release.save()
        record_audit(
            actor=user,
            action="release.publish_failed",
            target_type="release_record",
            target_id=str(release.id),
            summary=f"{domain.official_domain} {rel_ver} 发布失败，已保留原生效版本：{str(exc)[:120]}",
            site=snapshot.site,
            metadata={"domain": domain.official_domain, "error": str(exc)},
            request=request,
        )
        return release


def rollback_domain(domain: Domain, target_release: ReleaseRecord, user, request=None) -> ReleaseRecord:
    require_site_role(user, domain.site, SiteMembership.ROLE_PUBLISHER)
    if target_release.domain_id != domain.id or target_release.status != ReleaseRecord.STATUS_SUCCEEDED:
        raise BuildPipelineError("只能回滚到本域名历史上成功发布的版本。")
    artifact_dir = Path(target_release.artifact_dir)
    if not artifact_dir.is_dir():
        raise BuildPipelineError(f"历史版本产物目录不存在：{artifact_dir}")

    domain_doc = build_domain_snapshot_doc(target_release.snapshot, domain, ReleaseRecord.BUILD_ROLLBACK)
    passed, report = verify_static_artifact(artifact_dir, domain_doc)
    if not passed:
        raise BuildPipelineError("目标历史版本完整性校验未通过：" + "；".join(report.get("errors", [])))

    prev_current = ReleaseRecord.objects.filter(domain=domain, is_current=True).first()
    site_domain_root = settings.SITES_ROOT / domain.test_host
    _atomic_symlink(site_domain_root / "current", artifact_dir)

    ReleaseRecord.objects.filter(domain=domain, is_current=True).update(is_current=False)
    seq = ReleaseRecord.objects.filter(domain=domain).count() + 1
    rb_version = f"rollback-{target_release.snapshot.version}-{seq:03d}"
    rb_record = ReleaseRecord.objects.create(
        site=domain.site,
        domain=domain,
        snapshot=target_release.snapshot,
        release_version=rb_version,
        build_type=ReleaseRecord.BUILD_ROLLBACK,
        status=ReleaseRecord.STATUS_SUCCEEDED,
        artifact_dir=str(artifact_dir),
        smoke_check_passed=True,
        smoke_check_report=report,
        is_current=True,
        rolled_back_from=prev_current,
        triggered_by=user,
        finished_at=timezone.now(),
    )
    record_audit(
        actor=user,
        action="release.rollback",
        target_type="release_record",
        target_id=str(rb_record.id),
        summary=f"回滚 {domain.official_domain} 至快照 {target_release.snapshot.version}（原版本 {prev_current.release_version if prev_current else '无'}）",
        site=domain.site,
        metadata={
            "domain": domain.official_domain,
            "target_release_id": target_release.id,
            "target_snapshot": target_release.snapshot.version,
            "rolled_back_from": prev_current.release_version if prev_current else None,
        },
        request=request,
    )
    return rb_record
