import csv
import io
import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from core.models import AuditLog, Domain, Site, SiteMembership
from core.permissions import get_user_role, get_user_sites, record_audit, require_site_role
from monitoring.services import RANGE_MAP, compute_site_overview


def login_view(request):
    if request.user.is_authenticated:
        return redirect("overview:dashboard")
    error = ""
    if request.method == "POST":
        username = (request.POST.get("username") or "").strip()
        password = request.POST.get("password") or ""
        user = authenticate(request, username=username, password=password)
        if user is not None and user.is_active:
            login(request, user)
            record_audit(
                actor=user,
                action="auth.login",
                target_type="user",
                target_id=str(user.id),
                summary=f"账号 {user.username} 登录管理后台",
                request=request,
            )
            next_url = request.POST.get("next") or request.GET.get("next") or "/overview/"
            if not next_url.startswith("/") or next_url.startswith("//"):
                next_url = "/overview/"
            return redirect(next_url)
        error = "账号或密码错误，请核对后重试。"
    return render(request, "overview/login.html", {"error": error, "next": request.GET.get("next", "")})


@login_required
def logout_view(request):
    if request.method == "POST":
        record_audit(
            actor=request.user,
            action="auth.logout",
            target_type="user",
            target_id=str(request.user.id),
            summary=f"账号 {request.user.username} 退出管理后台",
            request=request,
        )
        logout(request)
    return redirect("overview:login")


def _resolve_authorized_site(request, site_slug: str | None) -> Site:
    allowed_sites = list(get_user_sites(request.user, min_role=SiteMembership.ROLE_VIEWER))
    if not allowed_sites:
        raise PermissionDenied("当前账号未分配任何站点访问权限。")
    if not site_slug:
        return allowed_sites[0]
    site = Site.objects.filter(slug=site_slug).first()
    if site is None:
        raise PermissionDenied("无权访问目标站点。")
    require_site_role(request.user, site, min_role=SiteMembership.ROLE_VIEWER)
    return site


@login_required
def dashboard_view(request):
    allowed_sites = list(get_user_sites(request.user, min_role=SiteMembership.ROLE_VIEWER))
    if not allowed_sites:
        return HttpResponseForbidden("当前账号未获授权访问任何站点。")

    requested_slug = (request.GET.get("site") or "").strip()
    try:
        site = _resolve_authorized_site(request, requested_slug or None)
    except PermissionDenied:
        return HttpResponseForbidden("无权访问其他站点的监测总览。")

    domain_param = (request.GET.get("domain") or "all").strip()
    selected_domain = None
    if domain_param and domain_param != "all":
        selected_domain = Domain.objects.filter(site=site, official_domain=domain_param).first()
        if selected_domain is None:
            return HttpResponseForbidden("请求的域名不属于当前已授权站点。")

    range_key = (request.GET.get("range") or "all").strip()
    if range_key not in RANGE_MAP:
        range_key = "all"

    overview_data = compute_site_overview(site, selected_domain=selected_domain, range_key=range_key)
    role = get_user_role(request.user, site)
    recent_audits = list(
        AuditLog.objects.filter(site=site)[:10]
        if not request.user.is_superuser
        else AuditLog.objects.all()[:10]
    )
    recent_releases = list(site.releases.select_related("domain", "snapshot", "triggered_by")[:8])

    return render(
        request,
        "overview/dashboard.html",
        {
            "sites": allowed_sites,
            "site": site,
            "role": role,
            "can_edit": role in (SiteMembership.ROLE_EDITOR, SiteMembership.ROLE_PUBLISHER, SiteMembership.ROLE_ADMIN),
            "can_publish": role in (SiteMembership.ROLE_PUBLISHER, SiteMembership.ROLE_ADMIN),
            "can_admin": request.user.is_superuser or role == SiteMembership.ROLE_ADMIN,
            "range_choices": [(k, v[0]) for k, v in RANGE_MAP.items()],
            "overview": overview_data,
            "domain_param": domain_param,
            "recent_audits": recent_audits,
            "recent_releases": recent_releases,
        },
    )


@login_required
def export_overview_view(request, fmt: str):
    requested_slug = (request.GET.get("site") or "").strip()
    try:
        site = _resolve_authorized_site(request, requested_slug or None)
    except PermissionDenied:
        return HttpResponseForbidden("无权导出其他站点数据。")

    domain_param = (request.GET.get("domain") or "all").strip()
    selected_domain = None
    if domain_param and domain_param != "all":
        selected_domain = Domain.objects.filter(site=site, official_domain=domain_param).first()
        if selected_domain is None:
            return HttpResponseForbidden("请求的域名不属于当前已授权站点。")

    range_key = (request.GET.get("range") or "all").strip()
    if range_key not in RANGE_MAP:
        range_key = "all"

    data = compute_site_overview(site, selected_domain=selected_domain, range_key=range_key)

    record_audit(
        actor=request.user,
        action=f"export.{fmt}",
        target_type="overview_report",
        target_id=f"{site.slug}:{domain_param}:{range_key}",
        summary=f"导出 {site.name} 监测报表（{fmt.upper()}，范围={domain_param}，时间={range_key}）",
        site=site,
        metadata={"format": fmt, "domain": domain_param, "range": range_key},
        request=request,
    )

    if fmt == "json":
        payload = {
            "site": {"slug": site.slug, "name": site.name, "online_inquiry_status": "未启用线上收件"},
            "scope": data["scope_label"],
            "time_range": data["range_label"],
            "collection_started_at": data["collection_started_at"].isoformat() if data["collection_started_at"] else None,
            "last_updated_at": data["last_updated_at"].isoformat() if data["last_updated_at"] else None,
            "totals": data["totals"],
            "top_products": data["top_products"],
            "domains": [
                {
                    "official_domain": r["domain"].official_domain,
                    "test_host": r["domain"].test_host,
                    "domain_status": r["domain"].domain_status,
                    "operational_state": r["state"]["code"],
                    "operational_state_label": r["state"]["label"],
                    "icp_number": r["domain"].icp_number,
                    "page_views": r["page_views"],
                    "product_page_views": r["product_page_views"],
                    "spa_page_views": r["spa_page_views"],
                    "brief_copy_success": r["brief_copy_success"],
                    "phone_click": r["phone_click"],
                    "email_click": r["email_click"],
                    "actions_per_100_product_views": r["actions_per_100_product_views"],
                    "gw_total_requests": r["gw_total_requests"],
                    "gw_html_requests": r["gw_html_requests"],
                    "gw_static_asset_requests": r["gw_static_asset_requests"],
                    "gw_4xx": r["gw_4xx"],
                    "gw_5xx": r["gw_5xx"],
                    "gw_avg_latency_ms": r["gw_avg_latency_ms"],
                    "latest_probe_ok": r["latest_probe"].is_success if r["latest_probe"] else None,
                    "cert_days_remaining": r["latest_probe"].cert_days_remaining if r["latest_probe"] else None,
                    "last_success_at": r["last_success_at"].isoformat() if r["last_success_at"] else None,
                }
                for r in data["domain_rows"]
            ],
        }
        resp = HttpResponse(
            json.dumps(payload, ensure_ascii=False, indent=2),
            content_type="application/json; charset=utf-8",
        )
        resp["Content-Disposition"] = f'attachment; filename="{site.slug}-overview-{range_key}.json"'
        return resp

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "站点",
                "正式域名",
                "状态判定",
                "备案号",
                "页面浏览量",
                "产品页浏览量",
                "单页导航切换浏览",
                "简报复制成功",
                "点击电话",
                "点击邮箱",
                "每百次产品浏览动作数",
                "网关总请求数",
                "页面文档请求数",
                "静态资源请求数",
                "4xx",
                "5xx",
                "平均耗时(ms)",
                "外部探测状态",
                "证书剩余天数",
                "线上收件状态",
            ]
        )
        for r in data["domain_rows"]:
            probe_txt = (
                "正常"
                if (r["latest_probe"] and r["latest_probe"].is_success)
                else (r["latest_probe"].error_code if r["latest_probe"] else "未探测")
            )
            writer.writerow(
                [
                    site.name,
                    r["domain"].official_domain,
                    r["state"]["label"],
                    r["domain"].icp_number,
                    r["page_views"],
                    r["product_page_views"],
                    r["spa_page_views"],
                    r["brief_copy_success"],
                    r["phone_click"],
                    r["email_click"],
                    r["actions_per_100_product_views"],
                    r["gw_total_requests"],
                    r["gw_html_requests"],
                    r["gw_static_asset_requests"],
                    r["gw_4xx"],
                    r["gw_5xx"],
                    r["gw_avg_latency_ms"],
                    probe_txt,
                    r["latest_probe"].cert_days_remaining if r["latest_probe"] else "",
                    "未启用线上收件",
                ]
            )
        resp = HttpResponse("\ufeff" + buf.getvalue(), content_type="text/csv; charset=utf-8")
        resp["Content-Disposition"] = f'attachment; filename="{site.slug}-overview-{range_key}.csv"'
        return resp

    return HttpResponseForbidden("不支持的导出格式。")


@login_required
def api_site_overview(request, site_slug: str):
    """Direct URL JSON API for RBAC & automated verification."""
    try:
        site = _resolve_authorized_site(request, site_slug)
    except PermissionDenied:
        return HttpResponseForbidden("Forbidden: cross-site access denied")
    domain_param = (request.GET.get("domain") or "all").strip()
    selected_domain = None
    if domain_param and domain_param != "all":
        selected_domain = get_object_or_404(Domain, site=site, official_domain=domain_param)
    range_key = (request.GET.get("range") or "all").strip()
    data = compute_site_overview(site, selected_domain=selected_domain, range_key=range_key)
    return JsonResponse(
        {
            "site": site.slug,
            "online_inquiry_status": "未启用线上收件",
            "scope": data["scope_label"],
            "range": data["range_label"],
            "totals": data["totals"],
            "top_products": data["top_products"],
            "domains": [
                {
                    "official_domain": r["domain"].official_domain,
                    "state": r["state"]["code"],
                    "state_label": r["state"]["label"],
                    "page_views": r["page_views"],
                    "product_page_views": r["product_page_views"],
                    "brief_copy_success": r["brief_copy_success"],
                    "phone_click": r["phone_click"],
                    "email_click": r["email_click"],
                    "gw_total_requests": r["gw_total_requests"],
                    "gw_static_asset_requests": r["gw_static_asset_requests"],
                    "gw_4xx": r["gw_4xx"],
                    "gw_5xx": r["gw_5xx"],
                    "latest_probe_ok": r["latest_probe"].is_success if r["latest_probe"] else None,
                    "cert_warning": r["latest_probe"].cert_warning if r["latest_probe"] else False,
                    "cert_days_remaining": r["latest_probe"].cert_days_remaining if r["latest_probe"] else None,
                }
                for r in data["domain_rows"]
            ],
        }
    )
