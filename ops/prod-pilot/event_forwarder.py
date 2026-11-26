#!/usr/bin/env python3
"""
Production Loopback HMAC Event Signing Forwarder (127.0.0.1:18081).

Why this exists:
  Origin `zhaohui` runs stock Ubuntu `nginx/1.24.0` without `njs` or `lua` modules.
  Rather than compiling/injecting third-party Nginx modules, Nginx proxies ONLY
  `POST /_track/event` (with hard-bound `X-Matched-Domain $server_name`) to this
  tiny stdlib-only Python daemon (~15 MiB RSS, zero pip dependencies).
  This daemon validates the matched domain, computes the HMAC-SHA256 gateway signature,
  and forwards to local Django (`127.0.0.1:18000/api/ingest/event`).
  If Django is temporarily unavailable, it returns HTTP 202 so visitor pages never fail.
"""

import hashlib
import hmac
import json
import os
import signal
import sys
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_TEST_SECRET = "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff01"
MAX_BODY_BYTES = 16384


def compute_gateway_signature(
    gateway_id: str,
    shared_secret: str,
    timestamp: str,
    matched_domain: str,
    raw_body: bytes,
) -> str:
    body_hash = hashlib.sha256(raw_body).hexdigest()
    msg = f"{gateway_id}:{timestamp}:{matched_domain}:{body_hash}".encode("utf-8")
    return hmac.new(shared_secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


class ForwarderConfig:
    def __init__(self):
        self.bind_host = os.environ.get("ZHAOHUI_FORWARDER_BIND", "127.0.0.1").strip()
        self.bind_port = int(os.environ.get("ZHAOHUI_FORWARDER_PORT", "18081"))
        self.backend_url = os.environ.get("ZHAOHUI_BACKEND_URL", "http://127.0.0.1:18000").rstrip("/")
        self.gateway_id = os.environ.get("ZHAOHUI_GATEWAY_ID", "prod-zhaohui-nginx-01").strip()
        self.gateway_secret = os.environ.get("ZHAOHUI_GATEWAY_SECRET", "").strip()
        self.allowed_domains = {
            h.strip().lower()
            for h in os.environ.get("ZHAOHUI_ALLOWED_DOMAINS", "jszhff.cn").split(",")
            if h.strip()
        }
        self.timeout_sec = float(os.environ.get("ZHAOHUI_FORWARDER_TIMEOUT", "2.0"))
        self.env_name = os.environ.get("ZHAOHUI_ENV", "production").strip().lower()

        if self.env_name == "production":
            if (
                not self.gateway_secret
                or self.gateway_secret == DEFAULT_TEST_SECRET
                or len(self.gateway_secret) < 32
            ):
                raise RuntimeError(
                    "ZHAOHUI_GATEWAY_SECRET must be a non-default secret (>=32 chars) in production."
                )
            if self.bind_host != "127.0.0.1":
                raise RuntimeError("event_forwarder must bind strictly to 127.0.0.1 in production.")


def make_handler(cfg: ForwarderConfig):
    class EventForwarderHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, format, *args):
            sys.stdout.write(f"[event-forwarder] {format % args}\n")
            sys.stdout.flush()

        def _send_json(self, status: int, body: bytes):
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def do_GET(self):
            if self.path == "/healthz":
                body = json.dumps(
                    {"status": "ok", "gateway_id": cfg.gateway_id, "allowed_domains": sorted(cfg.allowed_domains)}
                ).encode("utf-8")
                self._send_json(200, body)
                return
            self._send_json(404, b'{"error":"not_found"}')

        def do_POST(self):
            if self.path != "/_track/event":
                self._send_json(404, b'{"error":"not_found"}')
                return

            matched_domain = (self.headers.get("X-Matched-Domain") or "").strip().lower()
            if ":" in matched_domain:
                matched_domain = matched_domain.split(":", 1)[0]
            if not matched_domain or matched_domain not in cfg.allowed_domains:
                self._send_json(202, b'{"status":"ignored","reason":"domain_not_allowed"}')
                return

            try:
                content_len = int(self.headers.get("Content-Length", "0") or 0)
            except ValueError:
                self._send_json(400, b'{"error":"invalid_content_length"}')
                return
            if content_len < 0 or content_len > MAX_BODY_BYTES:
                self._send_json(413, b'{"error":"payload_too_large"}')
                return

            raw_body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            ts = str(int(time.time()))
            sig = compute_gateway_signature(
                cfg.gateway_id, cfg.gateway_secret, ts, matched_domain, raw_body
            )
            req = urllib.request.Request(
                f"{cfg.backend_url}/api/ingest/event",
                data=raw_body,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "X-Gateway-Id": cfg.gateway_id,
                    "X-Gateway-Timestamp": ts,
                    "X-Matched-Domain": matched_domain,
                    "X-Gateway-Signature": sig,
                },
            )
            try:
                with urllib.request.urlopen(req, timeout=cfg.timeout_sec) as resp:
                    self._send_json(resp.status, resp.read())
            except urllib.error.HTTPError as he:
                self._send_json(he.code, he.read())
            except Exception:
                self._send_json(202, b'{"status":"queued_backend_unavailable"}')

    return EventForwarderHandler


def main():
    cfg = ForwarderConfig()
    server = ThreadingHTTPServer((cfg.bind_host, cfg.bind_port), make_handler(cfg))
    server.allow_reuse_address = True

    stop_event = threading.Event()

    def _on_signal(signum, frame):
        stop_event.set()

    signal.signal(signal.SIGTERM, _on_signal)
    signal.signal(signal.SIGINT, _on_signal)

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    sys.stdout.write(
        f"[event-forwarder] Listening on {cfg.bind_host}:{cfg.bind_port} -> {cfg.backend_url} "
        f"(gateway_id={cfg.gateway_id}, domains={sorted(cfg.allowed_domains)})\n"
    )
    sys.stdout.flush()

    try:
        while not stop_event.is_set():
            stop_event.wait(0.5)
    finally:
        server.shutdown()
        server.server_close()
        sys.stdout.write("[event-forwarder] Stopped cleanly.\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
