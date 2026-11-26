import json
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST
from core.models import Domain, Site, SiteMembership
from core.permissions import get_user_role, get_user_sites, record_audit, require_site_role
from .models import ApprovedAsset, ContentSnapshot, ManagedContact, ManagedProduct, ReleaseRecord
from .pipeline import (
    BuildPipelineError,
    approve_snapshot,
    build_and_deploy_domain,
    create_snapshot,
    rollback_domain,
)


def _get_site_or_403(request, site_slug: str, min_role: str = SiteMembership.ROLE_VIEWER) -> Site:
    site = get_object_or_404(Site, slug=site_slug)
    require_site_role(request.user, site, min_role=min_role)
    return site


@login_required
def content_studio(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    role = get_user_role(request.user, site)
    products = list(site.managed_products.select_related("approved_asset").order_by("display_order"))
    contact = getattr(site, "managed_contact", None)
    assets = list(site.approved_assets.filter(is_approved=True))
    domains = list(site.domains.all())
    snapshots = list(site.snapshots.select_related("created_by", "approved_by")[:12])
    releases = list(site.releases.select_related("domain", "snapshot", "triggered_by")[:20])
    sites = list(get_user_sites(request.user))

    return render(
        request,
        "publishing/studio.html",
        {
            "site": site,
            "sites": sites,
            "role": role,
            "can_publish": role in (SiteMembership.ROLE_PUBLISHER, SiteMembership.ROLE_ADMIN),
            "products": products,
            "contact": contact,
            "assets": assets,
            "domains": domains,
            "snapshots": snapshots,
            "releases": releases,
        },
    )


@login_required
@require_POST
def update_product_draft(request, site_slug: str, product_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    product = get_object_or_404(ManagedProduct, id=product_id, site=site)

    display_name = (request.POST.get("display_name") or "").strip()
    summary = (request.POST.get("summary") or "").strip()
    asset_id = request.POST.get("approved_asset_id")

    if not display_name or not summary:
        messages.error(request, "产品展示名称与产品简介不能为空。")
        return redirect("publishing:studio", site_slug=site.slug)

    asset = get_object_or_404(ApprovedAsset, id=asset_id, site=site, is_approved=True)
    old_name = product.display_name
    product.display_name = display_name
    product.summary = summary
    product.approved_asset = asset
    product.updated_by = request.user
    product.full_clean()
    product.save()

    record_audit(
        actor=request.user,
        action="draft.product_save",
        target_type="managed_product",
        target_id=str(product.id),
        summary=f"保存产品草稿：{product.slug}（{old_name} -> {display_name}）",
        site=site,
        metadata={"slug": product.slug, "asset_code": asset.code},
        request=request,
    )
    messages.success(request, f"已保存「{display_name}」草稿。请生成快照并在目标测试域名预览。")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def update_contact_draft(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    contact = get_object_or_404(ManagedContact, site=site)

    email_display = (request.POST.get("email_display") or "").strip()
    phones_raw = (request.POST.get("phones_lines") or "").strip()
    addresses_raw = (request.POST.get("addresses_lines") or "").strip()

    phones = []
    for line in phones_raw.splitlines():
        val = line.strip()
        if not val:
            continue
        digits = "".join(ch for ch in val if ch.isdigit())
        phones.append({"display": val, "href": f"tel:{digits or val}"})

    addresses = []
    for line in addresses_raw.splitlines():
        val = line.strip()
        if not val:
            continue
        if "|" in val:
            region, addr = val.split("|", 1)
            addresses.append({"region": region.strip(), "address": addr.strip()})
        else:
            addresses.append({"region": "厂区地址", "address": val})

    if not email_display or not phones:
        messages.error(request, "公开联系电话与邮箱不能为空。")
        return redirect("publishing:studio", site_slug=site.slug)

    contact.phones_json = phones
    contact.email_display = email_display
    contact.email_href = f"mailto:{email_display}"
    contact.addresses_json = addresses
    contact.updated_by = request.user
    contact.save()

    record_audit(
        actor=request.user,
        action="draft.contact_save",
        target_type="managed_contact",
        target_id=str(contact.id),
        summary=f"更新站点 {site.slug} 公开联系方式草稿",
        site=site,
        metadata={"phone_count": len(phones), "address_count": len(addresses)},
        request=request,
    )
    messages.success(request, "已保存公开联系方式草稿。")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def create_snapshot_view(request, site_slug: str):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    note = (request.POST.get("note") or "").strip()
    snap = create_snapshot(site, request.user, note=note, request=request)
    messages.success(request, f"已生成内容快照 {snap.version}（SHA-256: {snap.checksum[:12]}）。")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def trigger_preview_view(request, site_slug: str, snapshot_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_EDITOR)
    snap = get_object_or_404(ContentSnapshot, id=snapshot_id, site=site)
    domain_id = request.POST.get("domain_id")
    if domain_id == "all":
        domains = list(site.domains.all())
    else:
        domains = [get_object_or_404(Domain, id=domain_id, site=site)]

    for dom in domains:
        rel = build_and_deploy_domain(
            snapshot=snap,
            domain=dom,
            build_type=ReleaseRecord.BUILD_PREVIEW,
            user=request.user,
            request=request,
        )
        if rel.status == ReleaseRecord.STATUS_SUCCEEDED:
            messages.success(request, f"预览已就绪：{dom.get_preview_http_url()}（{rel.release_version}）")
        else:
            messages.error(request, f"{dom.official_domain} 预览构建失败：{rel.error_message}")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def approve_snapshot_view(request, site_slug: str, snapshot_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_PUBLISHER)
    snap = get_object_or_404(ContentSnapshot, id=snapshot_id, site=site)
    approve_snapshot(snap, request.user, request=request)
    messages.success(request, f"快照 {snap.version} 已审核通过，可执行发布。")
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def publish_snapshot_view(request, site_slug: str, snapshot_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_PUBLISHER)
    snap = get_object_or_404(ContentSnapshot, id=snapshot_id, site=site)
    domain = get_object_or_404(Domain, id=request.POST.get("domain_id"), site=site)
    simulate_failure = (request.POST.get("simulate_failure") or "").strip() or None

    try:
        rel = build_and_deploy_domain(
            snapshot=snap,
            domain=domain,
            build_type=ReleaseRecord.BUILD_RELEASE,
            user=request.user,
            request=request,
            simulate_failure=simulate_failure,
        )
        if rel.status == ReleaseRecord.STATUS_SUCCEEDED:
            messages.success(request, f"已发布 {domain.official_domain} 至 {rel.release_version}。")
        else:
            messages.warning(request, f"发布失败并已保留旧版：{rel.error_message}")
    except BuildPipelineError as exc:
        messages.error(request, str(exc))
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
@require_POST
def rollback_release_view(request, site_slug: str, release_id: int):
    site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_PUBLISHER)
    target = get_object_or_404(ReleaseRecord, id=release_id, site=site)
    try:
        rb = rollback_domain(target.domain, target, request.user, request=request)
        messages.success(request, f"已将 {target.domain.official_domain} 回滚至 {target.snapshot.version}（记录 {rb.release_version}）。")
    except BuildPipelineError as exc:
        messages.error(request, str(exc))
    return redirect("publishing:studio", site_slug=site.slug)


@login_required
def api_site_products(request, site_slug: str):
    """Direct API endpoint for RBAC cross-site isolation verification."""
    try:
        site = _get_site_or_403(request, site_slug, min_role=SiteMembership.ROLE_VIEWER)
    except PermissionDenied:
        return HttpResponseForbidden("Forbidden: cross-site access denied")
    products = [
        {
            "id": p.id,
            "slug": p.slug,
            "display_name": p.display_name,
            "summary": p.summary,
            "image": p.approved_asset.image_path,
        }
        for p in site.managed_products.select_related("approved_asset")
    ]
    return JsonResponse({"site": site.slug, "products": products})
