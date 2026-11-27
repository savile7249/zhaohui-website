import json
import re
from datetime import datetime, timezone as dt_timezone
from urllib.parse import urlsplit
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from core.models import Domain, GatewayCredential
from .models import GatewayMetricBucket, PageEvent

ALLOWED_EVENT_KEYS = {"event_type", "page_path", "product_category", "is_spa_navigation", "site", "site_slug"}
SAFE_SLUG_RE = re.compile(r"^[a-z0-9_-]{1,64}$")
SAFE_PATH_RE = re.compile(r"^/[a-zA-Z0-9/_-]{0,180}$")


def normalize_host(raw_host: str) -> str:
    host = (raw_host or "").strip().lower()
    if ":" in host:
        host = host.split(":", 1)[0]
    return host


def normalize_page_path(raw_path: str) -> str:
    """Strip scheme, host, query string, fragment and normalize trailing slash."""
    text = (raw_path or "/").strip()
    parsed = urlsplit(text)
    path = parsed.path or "/"
    if not path.startswith("/"):
        path = "/" + path
    # Collapse duplicate slashes
    path = re.sub(r"/+", "/", path)
    if path != "/" and not path.endswith("/"):
        path = path + "/"
    if not SAFE_PATH_RE.match(path):
        return "/"
    return path


def normalize_product_category(raw_cat: str, page_path: str) -> str:
    cat = (raw_cat or "").strip().lower()
    if cat and SAFE_SLUG_RE.match(cat):
        return cat
    match = re.match(r"^/products/([a-z0-9_-]+)(?:/|$)", page_path)
    if match:
        return match.group(1)
    return ""


def _authenticate_gateway(request, matched_domain: str):
    gw_id = (request.META.get("HTTP_X_GATEWAY_ID") or "").strip()
    ts = (request.META.get("HTTP_X_GATEWAY_TIMESTAMP") or "").strip()
    sig = (request.META.get("HTTP_X_GATEWAY_SIGNATURE") or "").strip()
    if not gw_id or not ts or not sig:
        return None, JsonResponse({"error": "missing_gateway_auth"}, status=403)
    cred = GatewayCredential.objects.filter(gateway_id=gw_id, is_active=True).first()
    if not cred:
        return None, JsonResponse({"error": "unknown_gateway"}, status=403)
    if not cred.verify_signature(ts, matched_domain, request.body, sig):
        return None, JsonResponse({"error": "invalid_gateway_signature"}, status=403)
    return cred, None


def _lookup_domain(matched_host: str):
    if not matched_host or matched_host.startswith("preview-"):
        return None, "preview_excluded"
    if Domain.objects.filter(preview_host=matched_host).exists():
        return None, "preview_excluded"
    domain = Domain.objects.select_related("site").filter(
        Q(test_host=matched_host) | Q(official_domain=matched_host)
    ).first()
    if not domain:
        return None, "unknown_domain_excluded"
    if domain.domain_status != Domain.STATUS_ACTIVE:
        return domain, f"domain_{domain.domain_status}_excluded"
    if domain.collection_status != Domain.COLLECTION_ACTIVE:
        return domain, f"collection_{domain.collection_status}_excluded"
    return domain, None


@csrf_exempt
@require_POST
def ingest_event(request):
    matched_host = normalize_host(request.META.get("HTTP_X_MATCHED_DOMAIN", ""))
    cred, err_response = _authenticate_gateway(request, matched_host)
    if err_response is not None:
        return err_response

    now = timezone.now()
    cred.last_seen_at = now
    cred.save(update_fields=["last_seen_at"])

    domain, skip_reason = _lookup_domain(matched_host)
    if skip_reason is not None:
        return JsonResponse({"status": "ignored", "reason": skip_reason}, status=202)

    if cred.site_id and cred.site_id != domain.site_id:
        return JsonResponse({"error": "gateway_site_mismatch"}, status=403)

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)

    if not isinstance(payload, dict):
        return JsonResponse({"error": "invalid_payload"}, status=400)

    event_type = str(payload.get("event_type", "")).strip()
    if event_type not in PageEvent.ALLOWED_EVENT_TYPES:
        return JsonResponse({"error": "unsupported_event_type"}, status=400)

    # Strictly whitelist fields: drop any form input, phone/email text, clipboard, referer, or identity fields.
    # Also intentionally ignore any browser-claimed site/site_slug and attribute strictly to domain.site!
    spoofed_site = payload.get("site") or payload.get("site_slug")
    dropped_fields = sorted(k for k in payload.keys() if k not in ALLOWED_EVENT_KEYS)

    page_path = normalize_page_path(str(payload.get("page_path", "/")))
    product_category = normalize_product_category(str(payload.get("product_category", "")), page_path)
    is_spa = bool(payload.get("is_spa_navigation", False))

    event = PageEvent.objects.create(
        site=domain.site,
        domain=domain,
        event_type=event_type,
        page_path=page_path,
        product_category=product_category,
        is_spa_navigation=is_spa,
        gateway_id=cred.gateway_id,
        occurred_at=now,
    )

    update_fields = ["last_event_at"]
    domain.last_event_at = now
    if domain.collection_started_at is None:
        domain.collection_started_at = now
        update_fields.append("collection_started_at")
    domain.save(update_fields=update_fields)

    return JsonResponse(
        {
            "status": "accepted",
            "id": event.id,
            "attributed_site": domain.site.slug,
            "attributed_domain": domain.official_domain,
            "site_override_applied": bool(spoofed_site and str(spoofed_site) != domain.site.slug),
            "dropped_non_whitelist_count": len(dropped_fields),
        },
        status=201,
    )


@csrf_exempt
@require_POST
def ingest_gateway_metrics(request):
    matched_host = normalize_host(request.META.get("HTTP_X_MATCHED_DOMAIN", "__batch__"))
    cred, err_response = _authenticate_gateway(request, matched_host)
    if err_response is not None:
        return err_response

    now = timezone.now()
    cred.last_seen_at = now
    cred.save(update_fields=["last_seen_at"])

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({"error": "invalid_json"}, status=400)

    buckets = payload.get("buckets", [])
    heartbeats = payload.get("heartbeat_hosts", [])
    if not isinstance(buckets, list):
        return JsonResponse({"error": "invalid_buckets"}, status=400)

    accepted = 0
    ignored = 0

    for host_raw in heartbeats:
        host = normalize_host(str(host_raw))
        domain, skip_reason = _lookup_domain(host)
        if domain and skip_reason is None:
            domain.last_gateway_heartbeat_at = now
            domain.save(update_fields=["last_gateway_heartbeat_at"])

    for item in buckets:
        if not isinstance(item, dict):
            continue
        host = normalize_host(str(item.get("host", "")))
        domain, skip_reason = _lookup_domain(host)
        if skip_reason is not None or domain is None:
            ignored += 1
            continue
        if cred.site_id and cred.site_id != domain.site_id:
            ignored += 1
            continue

        bucket_ts = item.get("bucket_epoch")
        if bucket_ts:
            bucket_start = datetime.fromtimestamp(int(bucket_ts), tz=dt_timezone.utc)
        else:
            bucket_start = now.replace(second=0, microsecond=0)

        obj, _ = GatewayMetricBucket.objects.get_or_create(
            domain=domain,
            gateway_id=cred.gateway_id,
            bucket_start=bucket_start,
            defaults={"site": domain.site},
        )
        obj.total_requests += max(0, int(item.get("total_requests", 0)))
        obj.html_requests += max(0, int(item.get("html_requests", 0)))
        obj.static_asset_requests += max(0, int(item.get("static_asset_requests", 0)))
        obj.status_2xx += max(0, int(item.get("status_2xx", 0)))
        obj.status_4xx += max(0, int(item.get("status_4xx", 0)))
        obj.status_5xx += max(0, int(item.get("status_5xx", 0)))
        obj.latency_sum_ms += max(0.0, float(item.get("latency_sum_ms", 0.0)))
        obj.latency_count += max(0, int(item.get("latency_count", 0)))
        obj.max_latency_ms = max(obj.max_latency_ms, float(item.get("max_latency_ms", 0.0)))
        obj.save()

        domain.last_gateway_heartbeat_at = now
        update_fields = ["last_gateway_heartbeat_at"]
        if domain.collection_started_at is None:
            domain.collection_started_at = now
            update_fields.append("collection_started_at")
        domain.save(update_fields=update_fields)
        accepted += 1

    return JsonResponse({"status": "ok", "accepted": accepted, "ignored": ignored})
