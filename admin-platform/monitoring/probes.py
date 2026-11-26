import http.client
import socket
import ssl
import time
from datetime import datetime, timezone as dt_timezone
from cryptography import x509
from django.conf import settings
from django.utils import timezone
from core.models import Domain
from .models import AlertEvent, ProbeResult


def _open_or_update_alert(domain: Domain, alert_type: str, severity: str, message: str, last_success_at):
    existing = AlertEvent.objects.filter(
        domain=domain,
        alert_type=alert_type,
        status=AlertEvent.STATUS_OPEN,
    ).first()
    if existing:
        existing.message = message
        existing.severity = severity
        if last_success_at:
            existing.last_success_at = last_success_at
        existing.save(update_fields=["message", "severity", "last_success_at"])
        return existing
    return AlertEvent.objects.create(
        site=domain.site,
        domain=domain,
        alert_type=alert_type,
        status=AlertEvent.STATUS_OPEN,
        severity=severity,
        message=message,
        last_success_at=last_success_at,
    )


def _resolve_alert(domain: Domain, alert_type: str, now):
    AlertEvent.objects.filter(
        domain=domain,
        alert_type=alert_type,
        status=AlertEvent.STATUS_OPEN,
    ).update(status=AlertEvent.STATUS_RESOLVED, resolved_at=now)


def probe_domain(
    domain: Domain,
    *,
    target_host: str | None = None,
    target_port: int | None = None,
    ca_cert_path: str | None = None,
    timeout_sec: float = 5.0,
) -> ProbeResult:
    now = timezone.now()
    host_ip = target_host or settings.PROBE_TARGET_HOST
    port = int(target_port or settings.PROBE_TARGET_PORT)
    cafile = ca_cert_path or settings.PROBE_CA_CERT_PATH
    sni_host = domain.test_host
    probe_url = f"https://{sni_host}:{port}/"

    last_success = ProbeResult.objects.filter(domain=domain, is_success=True).first()
    last_success_at = last_success.checked_at if last_success else None

    tls_valid = False
    cert_not_after = None
    cert_days_remaining = None
    cert_warning = False
    http_status = None
    content_marker_ok = False
    is_success = False
    error_code = ""
    error_detail = ""
    elapsed_ms = None

    ctx = ssl.create_default_context(cafile=cafile)
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED

    t0 = time.monotonic()
    raw_sock = None
    tls_sock = None
    try:
        raw_sock = socket.create_connection((host_ip, port), timeout=timeout_sec)
        tls_sock = ctx.wrap_socket(raw_sock, server_hostname=sni_host)
        der_cert = tls_sock.getpeercert(binary_form=True)
        if der_cert:
            cert_obj = x509.load_der_x509_certificate(der_cert)
            cert_not_after = cert_obj.not_valid_after_utc
            delta_days = int((cert_not_after - datetime.now(dt_timezone.utc)).total_seconds() // 86400)
            cert_days_remaining = delta_days
            tls_valid = delta_days >= 0
            cert_warning = delta_days <= settings.PROBE_CERT_WARNING_DAYS
        else:
            tls_valid = True

        # Send HTTP/1.1 GET / over the verified TLS socket
        req_bytes = (
            f"GET / HTTP/1.1\r\n"
            f"Host: {sni_host}\r\n"
            f"User-Agent: ZhaohuiExternalProbe/1.0\r\n"
            f"Connection: close\r\n\r\n"
        ).encode("utf-8")
        tls_sock.sendall(req_bytes)

        class _PreConnectedHTTPResponse(http.client.HTTPResponse):
            pass

        resp = _PreConnectedHTTPResponse(tls_sock)
        resp.begin()
        http_status = resp.status
        body_bytes = resp.read(262144)
        elapsed_ms = round((time.monotonic() - t0) * 1000.0, 2)
        body_text = body_bytes.decode("utf-8", errors="ignore")
        marker = (domain.expected_home_marker or "").strip()
        content_marker_ok = (not marker) or (marker in body_text)

        if http_status != 200:
            error_code = "http_error"
            error_detail = f"首页返回异常状态码 HTTP {http_status}"
        elif not content_marker_ok:
            error_code = "content_mismatch"
            error_detail = f"首页内容未包含预期标记「{marker}」"
        elif not tls_valid:
            error_code = "tls_invalid"
            error_detail = "TLS 证书已过期或校验失败"
        else:
            is_success = True
            if cert_warning:
                error_code = "tls_expiring"
                error_detail = f"TLS 证书剩余 {cert_days_remaining} 天（阈值 ≤ {settings.PROBE_CERT_WARNING_DAYS} 天）"
    except ssl.SSLError as exc:
        elapsed_ms = round((time.monotonic() - t0) * 1000.0, 2)
        error_code = "tls_invalid"
        error_detail = f"TLS 握手失败：{exc}"
    except Exception as exc:
        elapsed_ms = round((time.monotonic() - t0) * 1000.0, 2)
        error_code = "connection_error"
        error_detail = f"外部连接失败：{exc}"
    finally:
        for sock in (tls_sock, raw_sock):
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    pass

    result = ProbeResult.objects.create(
        site=domain.site,
        domain=domain,
        probe_url=probe_url,
        checked_at=now,
        is_success=is_success,
        http_status=http_status,
        response_time_ms=elapsed_ms,
        tls_valid=tls_valid,
        cert_not_after=cert_not_after,
        cert_days_remaining=cert_days_remaining,
        cert_warning=cert_warning,
        content_marker_ok=content_marker_ok,
        error_code=error_code,
        error_detail=error_detail,
    )

    # Alert lifecycle: home_error
    if error_code in ("http_error", "content_mismatch", "connection_error"):
        _open_or_update_alert(
            domain,
            AlertEvent.TYPE_HOME_ERROR,
            AlertEvent.SEVERITY_CRITICAL,
            error_detail,
            last_success_at,
        )
    elif is_success:
        _resolve_alert(domain, AlertEvent.TYPE_HOME_ERROR, now)

    # Alert lifecycle: tls_invalid
    if error_code == "tls_invalid":
        _open_or_update_alert(
            domain,
            AlertEvent.TYPE_TLS_ERROR,
            AlertEvent.SEVERITY_CRITICAL,
            error_detail,
            last_success_at,
        )
    elif tls_valid:
        _resolve_alert(domain, AlertEvent.TYPE_TLS_ERROR, now)

    # Alert lifecycle: tls_expiring
    if cert_warning:
        _open_or_update_alert(
            domain,
            AlertEvent.TYPE_TLS_EXPIRING,
            AlertEvent.SEVERITY_WARNING,
            f"TLS 证书剩余 {cert_days_remaining} 天，请及时续期。",
            now if is_success else last_success_at,
        )
    elif tls_valid:
        _resolve_alert(domain, AlertEvent.TYPE_TLS_EXPIRING, now)

    # Heartbeat / collection interruption alert check
    if domain.collection_status == Domain.COLLECTION_INTERRUPTED or not domain.is_heartbeat_fresh(now=now):
        _open_or_update_alert(
            domain,
            AlertEvent.TYPE_COLLECTION_INTERRUPTED,
            AlertEvent.SEVERITY_WARNING,
            "未收到近期网关心跳或采集已标记中断，当前计数不可视作真实零访问。",
            domain.last_gateway_heartbeat_at or last_success_at,
        )
    else:
        _resolve_alert(domain, AlertEvent.TYPE_COLLECTION_INTERRUPTED, now)

    return result


def run_all_active_probes(**kwargs) -> list[ProbeResult]:
    results = []
    for domain in Domain.objects.select_related("site").filter(domain_status=Domain.STATUS_ACTIVE):
        results.append(probe_domain(domain, **kwargs))
    return results
