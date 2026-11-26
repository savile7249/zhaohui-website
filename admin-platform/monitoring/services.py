from datetime import timedelta
from django.db.models import Count, Max, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from core.models import Domain, Site
from .models import AlertEvent, GatewayMetricBucket, PageEvent, ProbeResult

PRODUCT_LABELS = {
    "tanks": "储罐",
    "reactors": "反应釜",
    "towers": "塔器",
    "piping": "管道与管件",
    "sim-vessel": "演示耐蚀容器",
    "sim-pipe": "演示防腐管路",
}

RANGE_MAP = {
    "24h": ("近 24 小时", timedelta(hours=24)),
    "7d": ("近 7 天", timedelta(days=7)),
    "30d": ("近 30 天", timedelta(days=30)),
    "all": ("从开始采集之日起", None),
}


def compute_domain_metrics(domain: Domain, start_dt=None, end_dt=None, now=None) -> dict:
    now = now or timezone.now()
    ev_qs = PageEvent.objects.filter(domain=domain)
    gw_qs = GatewayMetricBucket.objects.filter(domain=domain)
    if start_dt is not None:
        ev_qs = ev_qs.filter(occurred_at__gte=start_dt)
        gw_qs = gw_qs.filter(bucket_start__gte=start_dt - timedelta(minutes=1))
    if end_dt is not None:
        ev_qs = ev_qs.filter(occurred_at__lte=end_dt)
        gw_qs = gw_qs.filter(bucket_start__lte=end_dt)

    counts_raw = dict(
        ev_qs.values("event_type").annotate(c=Count("id")).values_list("event_type", "c")
    )
    page_views = counts_raw.get(PageEvent.EVENT_PAGE_VIEW, 0)
    product_page_views = ev_qs.filter(
        event_type=PageEvent.EVENT_PAGE_VIEW,
    ).exclude(product_category="").count()
    spa_page_views = ev_qs.filter(
        event_type=PageEvent.EVENT_PAGE_VIEW,
        is_spa_navigation=True,
    ).count()
    brief_copy_success = counts_raw.get(PageEvent.EVENT_BRIEF_COPY_SUCCESS, 0)
    phone_click = counts_raw.get(PageEvent.EVENT_PHONE_CLICK, 0)
    email_click = counts_raw.get(PageEvent.EVENT_EMAIL_CLICK, 0)
    inquiry_actions_total = brief_copy_success + phone_click + email_click

    gw_agg = gw_qs.aggregate(
        total_requests=Sum("total_requests"),
        html_requests=Sum("html_requests"),
        static_asset_requests=Sum("static_asset_requests"),
        status_2xx=Sum("status_2xx"),
        status_4xx=Sum("status_4xx"),
        status_5xx=Sum("status_5xx"),
        latency_sum_ms=Sum("latency_sum_ms"),
        latency_count=Sum("latency_count"),
        max_latency_ms=Max("max_latency_ms"),
        last_gw_update=Max("updated_at"),
    )
    gw_total = gw_agg["total_requests"] or 0
    gw_html = gw_agg["html_requests"] or 0
    gw_static = gw_agg["static_asset_requests"] or 0
    gw_4xx = gw_agg["status_4xx"] or 0
    gw_5xx = gw_agg["status_5xx"] or 0
    lat_count = gw_agg["latency_count"] or 0
    avg_latency_ms = round((gw_agg["latency_sum_ms"] or 0.0) / lat_count, 2) if lat_count else 0.0
    max_latency_ms = round(gw_agg["max_latency_ms"] or 0.0, 2)

    latest_probe = ProbeResult.objects.filter(domain=domain).first()
    last_success_probe = ProbeResult.objects.filter(domain=domain, is_success=True).first()
    open_alerts = list(AlertEvent.objects.filter(domain=domain, status=AlertEvent.STATUS_OPEN))

    op_state = domain.classify_operational_state(
        window_page_views=page_views,
        latest_probe=latest_probe,
        now=now,
    )

    last_updated_candidates = [
        dt
        for dt in [
            domain.last_event_at,
            domain.last_gateway_heartbeat_at,
            latest_probe.checked_at if latest_probe else None,
            gw_agg["last_gw_update"],
        ]
        if dt is not None
    ]
    last_updated_at = max(last_updated_candidates) if last_updated_candidates else None

    return {
        "domain": domain,
        "state": op_state,
        "page_views": page_views,
        "product_page_views": product_page_views,
        "spa_page_views": spa_page_views,
        "brief_copy_success": brief_copy_success,
        "phone_click": phone_click,
        "email_click": email_click,
        "inquiry_actions_total": inquiry_actions_total,
        "actions_per_100_product_views": round(
            (inquiry_actions_total / product_page_views) * 100.0, 2
        ) if product_page_views > 0 else 0.0,
        "gw_total_requests": gw_total,
        "gw_html_requests": gw_html,
        "gw_static_asset_requests": gw_static,
        "gw_4xx": gw_4xx,
        "gw_5xx": gw_5xx,
        "gw_avg_latency_ms": avg_latency_ms,
        "gw_max_latency_ms": max_latency_ms,
        "latest_probe": latest_probe,
        "last_success_at": last_success_probe.checked_at if last_success_probe else None,
        "open_alerts": open_alerts,
        "collection_started_at": domain.collection_started_at,
        "last_updated_at": last_updated_at,
    }


def compute_site_overview(site: Site, selected_domain: Domain | None = None, range_key: str = "7d") -> dict:
    now = timezone.now()
    if range_key not in RANGE_MAP:
        range_key = "7d"
    range_label, delta = RANGE_MAP[range_key]
    start_dt = (now - delta) if delta is not None else None

    all_domains = list(site.domains.all())
    enabled_domains = [d for d in all_domains if d.domain_status == Domain.STATUS_ACTIVE]

    all_domain_rows = [compute_domain_metrics(d, start_dt=start_dt, end_dt=now, now=now) for d in all_domains]
    row_by_id = {row["domain"].id: row for row in all_domain_rows}

    if selected_domain is not None:
        scope_domains = [selected_domain]
        scope_rows = [row_by_id[selected_domain.id]]
        scope_label = f"单域名：{selected_domain.official_domain}"
    else:
        scope_domains = enabled_domains
        scope_rows = [row_by_id[d.id] for d in enabled_domains]
        scope_label = f"全部已启用域名（{len(enabled_domains)} 个）"

    # Strict sum equality: site totals == sum of included domain totals!
    totals = {
        "page_views": sum(r["page_views"] for r in scope_rows),
        "product_page_views": sum(r["product_page_views"] for r in scope_rows),
        "spa_page_views": sum(r["spa_page_views"] for r in scope_rows),
        "brief_copy_success": sum(r["brief_copy_success"] for r in scope_rows),
        "phone_click": sum(r["phone_click"] for r in scope_rows),
        "email_click": sum(r["email_click"] for r in scope_rows),
        "inquiry_actions_total": sum(r["inquiry_actions_total"] for r in scope_rows),
        "gw_total_requests": sum(r["gw_total_requests"] for r in scope_rows),
        "gw_html_requests": sum(r["gw_html_requests"] for r in scope_rows),
        "gw_static_asset_requests": sum(r["gw_static_asset_requests"] for r in scope_rows),
        "gw_4xx": sum(r["gw_4xx"] for r in scope_rows),
        "gw_5xx": sum(r["gw_5xx"] for r in scope_rows),
    }
    totals["actions_per_100_product_views"] = (
        round((totals["inquiry_actions_total"] / totals["product_page_views"]) * 100.0, 2)
        if totals["product_page_views"] > 0
        else 0.0
    )
    totals["brief_copy_per_100"] = (
        round((totals["brief_copy_success"] / totals["product_page_views"]) * 100.0, 2)
        if totals["product_page_views"] > 0
        else 0.0
    )
    totals["phone_click_per_100"] = (
        round((totals["phone_click"] / totals["product_page_views"]) * 100.0, 2)
        if totals["product_page_views"] > 0
        else 0.0
    )
    totals["email_click_per_100"] = (
        round((totals["email_click"] / totals["product_page_views"]) * 100.0, 2)
        if totals["product_page_views"] > 0
        else 0.0
    )

    # Popular products within scope
    scope_domain_ids = [d.id for d in scope_domains]
    ev_scope_qs = PageEvent.objects.filter(site=site, domain_id__in=scope_domain_ids)
    if start_dt is not None:
        ev_scope_qs = ev_scope_qs.filter(occurred_at__gte=start_dt)

    managed_name_map = {
        mp.slug: mp.display_name for mp in site.managed_products.all()
    } if hasattr(site, "managed_products") else {}

    top_products_raw = (
        ev_scope_qs.filter(event_type=PageEvent.EVENT_PAGE_VIEW)
        .exclude(product_category="")
        .values("product_category")
        .annotate(views=Count("id"))
        .order_by("-views", "product_category")
    )
    top_products = [
        {
            "slug": item["product_category"],
            "name": managed_name_map.get(
                item["product_category"],
                PRODUCT_LABELS.get(item["product_category"], item["product_category"]),
            ),
            "views": item["views"],
        }
        for item in top_products_raw
    ]

    daily_series = list(
        ev_scope_qs.filter(event_type=PageEvent.EVENT_PAGE_VIEW)
        .annotate(day=TruncDate("occurred_at"))
        .values("day")
        .annotate(views=Count("id"))
        .order_by("day")
    )

    collection_starts = [r["collection_started_at"] for r in scope_rows if r["collection_started_at"]]
    last_updates = [r["last_updated_at"] for r in scope_rows if r["last_updated_at"]]

    recent_alerts = list(
        AlertEvent.objects.filter(site=site).select_related("domain")[:20]
    )

    return {
        "site": site,
        "selected_domain": selected_domain,
        "scope_label": scope_label,
        "range_key": range_key,
        "range_label": range_label,
        "start_dt": start_dt,
        "end_dt": now,
        "collection_started_at": min(collection_starts) if collection_starts else None,
        "last_updated_at": max(last_updates) if last_updates else None,
        "totals": totals,
        "domain_rows": all_domain_rows,
        "scope_rows": scope_rows,
        "top_products": top_products,
        "daily_series": daily_series,
        "recent_alerts": recent_alerts,
    }
