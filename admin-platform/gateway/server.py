#!/usr/bin/env python3
"""
Local Isolated Trusted Gateway (HTTP 18080 + HTTPS 18443).
- Serves static builds directly from .local-test-env/sites/<host>/current (and preview-<host> from preview)
  so public websites keep working even when Django Admin is stopped.
- Proxies /_track/event with HMAC-signed trusted gateway headers (X-Gateway-Id / X-Gateway-Signature / X-Matched-Domain).
- Aggregates per-domain HTML/static-asset counts, 2xx/4xx/5xx, latency, and sends periodic heartbeats to Django.
- Supports dynamic TLS certificate reload (for TLS expiry warning & recovery verification) and fault simulation control.
"""

import hashlib
import hmac
import json
import mimetypes
import os
import posixpath
import signal
import ssl
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

STATIC_ASSET_EXTS = {
    ".js", ".css", ".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map", ".json", ".txt", ".xml",
}


class GatewayConfig:
    def __init__(self):
        self.runtime_dir = Path(os.environ.get("ZHAOHUI_RUNTIME_DIR", ".local-test-env")).resolve()
        self.sites_root = self.runtime_dir / "sites"
        self.certs_dir = self.runtime_dir / "certs"
        self.fault_file = self.runtime_dir / "gateway-faults.json"
        self.http_port = int(os.environ.get("ZHAOHUI_GATEWAY_HTTP_PORT", "18080"))
        self.https_port = int(os.environ.get("ZHAOHUI_GATEWAY_HTTPS_PORT", "18443"))
        self.backend_url = os.environ.get("ZHAOHUI_BACKEND_URL", "http://127.0.0.1:18000").rstrip("/")
        self.gateway_id = os.environ.get("ZHAOHUI_GATEWAY_ID", "local-test-gw-01")
        self.gateway_secret = os.environ.get(
            "ZHAOHUI_GATEWAY_SECRET",
            "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff01",
        )
        self.flush_interval = float(os.environ.get("ZHAOHUI_GATEWAY_FLUSH_INTERVAL", "5.0"))
        self.registered_hosts = [
            h.strip().lower()
            for h in os.environ.get(
                "ZHAOHUI_GATEWAY_HOSTS",
                "jszhff.localhost,zhaohuifangfu.localhost,sim-site.localhost",
            ).split(",")
            if h.strip()
        ]
        self.tls_cert = self.certs_dir / "server.crt"
        self.tls_key = self.certs_dir / "server.key"

    def sign(self, timestamp: str, matched_domain: str, raw_body: bytes) -> str:
        body_hash = hashlib.sha256(raw_body).hexdigest()
        msg = f"{self.gateway_id}:{timestamp}:{matched_domain}:{body_hash}".encode("utf-8")
        return hmac.new(self.gateway_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    def load_faults(self) -> dict:
        if not self.fault_file.is_file():
            return {}
        try:
            return json.loads(self.fault_file.read_text(encoding="utf-8"))
        except Exception:
            return {}


class MetricsCollector:
    def __init__(self, cfg: GatewayConfig):
        self.cfg = cfg
        self._lock = threading.Lock()
        self._buckets: dict[tuple[str, int], dict] = {}
        self._stop = threading.Event()

    def record(self, host: str, path: str, status: int, latency_ms: float):
        if not host or host.startswith("preview-"):
            return
        bucket_epoch = (int(time.time()) // 60) * 60
        key = (host, bucket_epoch)
        ext = Path(path.rstrip("/")).suffix.lower()
        is_asset = ext in STATIC_ASSET_EXTS
        with self._lock:
            b = self._buckets.get(key)
            if b is None:
                b = {
                    "host": host,
                    "bucket_epoch": bucket_epoch,
                    "total_requests": 0,
                    "html_requests": 0,
                    "static_asset_requests": 0,
                    "status_2xx": 0,
                    "status_4xx": 0,
                    "status_5xx": 0,
                    "latency_sum_ms": 0.0,
                    "latency_count": 0,
                    "max_latency_ms": 0.0,
                }
                self._buckets[key] = b
            b["total_requests"] += 1
            if is_asset:
                b["static_asset_requests"] += 1
            else:
                b["html_requests"] += 1
            if 200 <= status < 300:
                b["status_2xx"] += 1
            elif 400 <= status < 500:
                b["status_4xx"] += 1
            elif status >= 500:
                b["status_5xx"] += 1
            b["latency_sum_ms"] += latency_ms
            b["latency_count"] += 1
            if latency_ms > b["max_latency_ms"]:
                b["max_latency_ms"] = latency_ms

    def flush(self) -> bool:
        faults = self.cfg.load_faults()
        paused_hosts = set(faults.get("pause_heartbeat_hosts", []))
        with self._lock:
            items = list(self._buckets.values())
            self._buckets.clear()

        items = [it for it in items if it["host"] not in paused_hosts]
        heartbeat_hosts = [h for h in self.cfg.registered_hosts if h not in paused_hosts]

        payload = {
            "gateway_id": self.cfg.gateway_id,
            "buckets": items,
            "heartbeat_hosts": heartbeat_hosts,
        }
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        ts = str(int(time.time()))
        sig = self.cfg.sign(ts, "__batch__", raw)
        req = urllib.request.Request(
            f"{self.cfg.backend_url}/api/ingest/gateway-metrics",
            data=raw,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Gateway-Id": self.cfg.gateway_id,
                "X-Gateway-Timestamp": ts,
                "X-Matched-Domain": "__batch__",
                "X-Gateway-Signature": sig,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                return 200 <= resp.status < 300
        except Exception:
            # Put unsent buckets back if backend is temporarily stopped (static serving unaffected)
            if items:
                with self._lock:
                    for it in items:
                        k = (it["host"], it["bucket_epoch"])
                        existing = self._buckets.get(k)
                        if existing is None:
                            self._buckets[k] = it
                        else:
                            for f in ("total_requests", "html_requests", "static_asset_requests", "status_2xx", "status_4xx", "status_5xx", "latency_count"):
                                existing[f] += it[f]
                            existing["latency_sum_ms"] += it["latency_sum_ms"]
                            existing["max_latency_ms"] = max(existing["max_latency_ms"], it["max_latency_ms"])
            return False

    def run_loop(self):
        while not self._stop.wait(self.cfg.flush_interval):
            self.flush()

    def stop(self):
        self._stop.set()


class ReloadableTLSServer(ThreadingHTTPServer):
    """ThreadingHTTPServer that dynamically reloads TLS cert/key whenever mtime changes."""

    allow_reuse_address = True

    def __init__(self, server_address, handler_cls, cfg: GatewayConfig):
        self.cfg = cfg
        self._ctx_lock = threading.Lock()
        self._cert_mtime = 0.0
        self._ssl_ctx = self._build_ctx()
        super().__init__(server_address, handler_cls)

    def _build_ctx(self) -> ssl.SSLContext:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile=str(self.cfg.tls_cert), keyfile=str(self.cfg.tls_key))
        try:
            self._cert_mtime = self.cfg.tls_cert.stat().st_mtime
        except OSError:
            self._cert_mtime = 0.0
        return ctx

    def _get_ctx(self) -> ssl.SSLContext:
        try:
            cur_mtime = self.cfg.tls_cert.stat().st_mtime
        except OSError:
            cur_mtime = self._cert_mtime
        if cur_mtime != self._cert_mtime:
            with self._ctx_lock:
                if cur_mtime != self._cert_mtime:
                    self._ssl_ctx = self._build_ctx()
        return self._ssl_ctx

    def get_request(self):
        newsocket, fromaddr = super().get_request()
        ctx = self._get_ctx()
        connstream = ctx.wrap_socket(newsocket, server_side=True)
        return connstream, fromaddr


def make_handler(cfg: GatewayConfig, collector: MetricsCollector):
    class TrustedGatewayHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format, *args):
            sys.stdout.write(f"[gateway] {self.address_string()} - {format % args}\n")
            sys.stdout.flush()

        def _host(self) -> str:
            raw = (self.headers.get("Host") or "").strip().lower()
            if ":" in raw:
                raw = raw.split(":", 1)[0]
            return raw

        def _resolve_docroot(self, host: str) -> tuple[Path | None, bool]:
            if host.startswith("preview-"):
                base_host = host[len("preview-"):]
                p = cfg.sites_root / base_host / "preview"
                return (p if p.exists() else None), True
            p = cfg.sites_root / host / "current"
            return (p if p.exists() else None), False

        def _send_bytes(self, status: int, body: bytes, content_type: str, extra_headers: dict | None = None):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("X-Served-By", cfg.gateway_id)
            if extra_headers:
                for k, v in extra_headers.items():
                    self.send_header(k, v)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def do_HEAD(self):
            self.do_GET()

        def do_POST(self):
            t0 = time.monotonic()
            parsed = urlsplit(self.path)
            path = parsed.path
            host = self._host()

            if path == "/_gateway/flush":
                ok = collector.flush()
                body = json.dumps({"flushed": ok}).encode("utf-8")
                self._send_bytes(200 if ok else 503, body, "application/json")
                return

            if path == "/_track/event":
                length = min(int(self.headers.get("Content-Length", "0") or 0), 16384)
                raw_body = self.rfile.read(length) if length > 0 else b"{}"
                ts = str(int(time.time()))
                sig = cfg.sign(ts, host, raw_body)
                req = urllib.request.Request(
                    f"{cfg.backend_url}/api/ingest/event",
                    data=raw_body,
                    method="POST",
                    headers={
                        "Content-Type": "application/json",
                        "X-Gateway-Id": cfg.gateway_id,
                        "X-Gateway-Timestamp": ts,
                        "X-Matched-Domain": host,
                        "X-Gateway-Signature": sig,
                    },
                )
                try:
                    with urllib.request.urlopen(req, timeout=3.0) as resp:
                        resp_body = resp.read()
                        self._send_bytes(resp.status, resp_body, "application/json")
                except urllib.error.HTTPError as he:
                    self._send_bytes(he.code, he.read(), "application/json")
                except Exception:
                    self._send_bytes(202, b'{"status":"queued_backend_unavailable"}', "application/json")
                return

            self._send_bytes(405, b'{"error":"method_not_allowed"}', "application/json")
            collector.record(host, path, 405, (time.monotonic() - t0) * 1000.0)

        def do_GET(self):
            t0 = time.monotonic()
            parsed = urlsplit(self.path)
            path = parsed.path or "/"
            host = self._host()

            if path == "/_gateway/health":
                self._send_bytes(200, b'{"status":"ok","gateway":"' + cfg.gateway_id.encode() + b'"}', "application/json")
                return

            # Simulated homepage fault injection (for Stage 2 alert & recovery testing)
            faults = cfg.load_faults()
            home_fault = faults.get("home_faults", {}).get(host)
            if home_fault and path in ("/", "/index.html"):
                f_status = int(home_fault.get("status", 503))
                f_body = str(home_fault.get("body", "Simulated Homepage Error")).encode("utf-8")
                self._send_bytes(f_status, f_body, "text/html; charset=utf-8")
                collector.record(host, path, f_status, (time.monotonic() - t0) * 1000.0)
                return

            docroot, is_preview = self._resolve_docroot(host)
            if docroot is None:
                self._send_bytes(404, f"Unknown or unpublished host: {host}".encode("utf-8"), "text/plain; charset=utf-8")
                collector.record(host, path, 404, (time.monotonic() - t0) * 1000.0)
                return

            clean_rel = posixpath.normpath(path).lstrip("/")
            if clean_rel.startswith(".."):
                self._send_bytes(403, b"Forbidden", "text/plain")
                collector.record(host, path, 403, (time.monotonic() - t0) * 1000.0)
                return

            target = docroot / clean_rel if clean_rel and clean_rel != "." else docroot / "index.html"
            if target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                # Check 404.html
                not_found = docroot / "404.html"
                body = not_found.read_bytes() if not_found.is_file() else b"404 Not Found"
                self._send_bytes(404, body, "text/html; charset=utf-8")
                collector.record(host, path, 404, (time.monotonic() - t0) * 1000.0)
                return

            try:
                resolved_root = docroot.resolve()
                resolved_target = target.resolve()
                if not str(resolved_target).startswith(str(resolved_root)):
                    self._send_bytes(403, b"Forbidden", "text/plain")
                    collector.record(host, path, 403, (time.monotonic() - t0) * 1000.0)
                    return
                body = resolved_target.read_bytes()
            except OSError:
                self._send_bytes(500, b"Internal Server Error", "text/plain")
                collector.record(host, path, 500, (time.monotonic() - t0) * 1000.0)
                return

            ctype, _ = mimetypes.guess_type(str(resolved_target))
            if not ctype:
                ctype = "application/octet-stream"
            if ctype.startswith("text/") or ctype == "application/javascript":
                ctype += "; charset=utf-8"

            headers = {"X-Preview-Env": "1"} if is_preview else None
            self._send_bytes(200, body, ctype, extra_headers=headers)
            if not is_preview:
                collector.record(host, path, 200, (time.monotonic() - t0) * 1000.0)

    return TrustedGatewayHandler


def main():
    cfg = GatewayConfig()
    collector = MetricsCollector(cfg)
    handler_cls = make_handler(cfg, collector)

    http_server = ThreadingHTTPServer(("127.0.0.1", cfg.http_port), handler_cls)
    http_server.allow_reuse_address = True

    https_server = None
    if cfg.tls_cert.is_file() and cfg.tls_key.is_file():
        https_server = ReloadableTLSServer(("127.0.0.1", cfg.https_port), handler_cls, cfg)

    flush_thread = threading.Thread(target=collector.run_loop, daemon=True)
    flush_thread.start()

    threads = [threading.Thread(target=http_server.serve_forever, daemon=True)]
    if https_server:
        threads.append(threading.Thread(target=https_server.serve_forever, daemon=True))

    for t in threads:
        t.start()

    sys.stdout.write(
        f"[gateway] Started HTTP on 127.0.0.1:{cfg.http_port}"
        + (f" and HTTPS on 127.0.0.1:{cfg.https_port}" if https_server else " (HTTPS disabled: no certs)")
        + "\n"
    )
    sys.stdout.flush()

    stop_event = threading.Event()

    def _handle_sig(signum, frame):
        stop_event.set()

    signal.signal(signal.SIGTERM, _handle_sig)
    signal.signal(signal.SIGINT, _handle_sig)

    try:
        while not stop_event.is_set():
            stop_event.wait(0.5)
    finally:
        collector.stop()
        collector.flush()
        http_server.shutdown()
        if https_server:
            https_server.shutdown()
        sys.stdout.write("[gateway] Stopped cleanly.\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
