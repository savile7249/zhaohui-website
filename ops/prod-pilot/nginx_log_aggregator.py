#!/usr/bin/env python3
"""
Incremental Nginx JSON-Line Access Log Aggregator -> Django /api/ingest/gateway-metrics.

Designed for origin `zhaohui` (Ubuntu 24.04.4, nginx/1.24.0 + daily logrotate):
- Reads /var/log/nginx/jszhff.cn.metrics.log incrementally using an (inode, offset) bookmark.
- Handles daily logrotate transparently: if inode changes, drains any trailing lines from
  `<log_path>.1` when its inode matches the previous bookmark before switching to the new file.
- Classifies static assets vs HTML document requests, ignores internal `/_track/event` &
  `/.well-known/` paths, groups into per-(host, minute) buckets, and signs the batch with
  HMAC-SHA256 (`GatewayCredential`).
- Always sends `heartbeat_hosts` even during 0-traffic minutes so the dashboard accurately
  distinguishes "真实零访问 (true_zero)" from "数据中断 (interrupted)".
"""

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

STATIC_ASSET_EXTS = {
    ".js", ".css", ".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".ico", ".woff", ".woff2", ".ttf", ".eot", ".map", ".json", ".txt", ".xml",
}
IGNORED_PREFIXES = ("/_track/", "/.well-known/")


def sign_batch(gateway_id: str, secret: str, timestamp: str, raw_body: bytes) -> str:
    body_hash = hashlib.sha256(raw_body).hexdigest()
    msg = f"{gateway_id}:{timestamp}:__batch__:{body_hash}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def load_state(state_file: Path) -> dict:
    if not state_file.is_file():
        return {"inode": None, "offset": 0}
    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
        return {"inode": data.get("inode"), "offset": int(data.get("offset", 0))}
    except Exception:
        return {"inode": None, "offset": 0}


def save_state(state_file: Path, inode: int | None, offset: int):
    state_file.parent.mkdir(parents=True, exist_ok=True)
    tmp = state_file.with_suffix(state_file.suffix + ".tmp")
    tmp.write_text(json.dumps({"inode": inode, "offset": offset}, indent=2), encoding="utf-8")
    os.replace(tmp, state_file)


def read_incremental_lines(log_path: Path, state: dict) -> tuple[list[str], int | None, int]:
    """Read new complete lines from log_path (plus rotated .1 tail if rotated)."""
    if not log_path.is_file():
        return [], state.get("inode"), int(state.get("offset", 0))

    st = log_path.stat()
    cur_inode = st.st_ino
    cur_size = st.st_size
    prev_inode = state.get("inode")
    prev_offset = int(state.get("offset", 0))

    lines: list[str] = []

    # Handle logrotate (inode changed) or copytruncate (size < prev_offset)
    if prev_inode is not None and prev_inode != cur_inode:
        rotated = Path(f"{log_path}.1")
        if rotated.is_file():
            try:
                rot_st = rotated.stat()
                if rot_st.st_ino == prev_inode and rot_st.st_size > prev_offset:
                    with rotated.open("rb") as rf:
                        rf.seek(prev_offset)
                        raw = rf.read()
                    for raw_line in raw.splitlines():
                        lines.append(raw_line.decode("utf-8", errors="ignore"))
            except OSError:
                pass
        start_offset = 0
    elif prev_offset > cur_size:
        start_offset = 0
    else:
        start_offset = prev_offset

    new_offset = start_offset
    if cur_size > start_offset:
        with log_path.open("rb") as f:
            f.seek(start_offset)
            chunk = f.read()
        # Only consume up to the last newline so partial writes are deferred to next tick
        last_nl = chunk.rfind(b"\n")
        if last_nl != -1:
            complete = chunk[: last_nl + 1]
            new_offset = start_offset + len(complete)
            for raw_line in complete.splitlines():
                lines.append(raw_line.decode("utf-8", errors="ignore"))

    return lines, cur_inode, new_offset


def aggregate_lines(lines: list[str], allowed_hosts: set[str]) -> list[dict]:
    buckets: dict[tuple[str, int], dict] = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue

        host = str(rec.get("server_name") or rec.get("host") or "").strip().lower()
        if ":" in host:
            host = host.split(":", 1)[0]
        if not host or (allowed_hosts and host not in allowed_hosts):
            continue

        uri = str(rec.get("uri") or "/")
        if any(uri.startswith(pref) for pref in IGNORED_PREFIXES):
            continue

        try:
            msec = float(rec.get("msec", time.time()))
            status = int(rec.get("status", 0))
            latency_ms = max(0.0, float(rec.get("request_time", 0.0)) * 1000.0)
        except (TypeError, ValueError):
            continue

        bucket_epoch = (int(msec) // 60) * 60
        key = (host, bucket_epoch)
        ext = Path(uri.rstrip("/")).suffix.lower()
        is_asset = ext in STATIC_ASSET_EXTS

        b = buckets.get(key)
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
            buckets[key] = b

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
        b["latency_sum_ms"] = round(b["latency_sum_ms"] + latency_ms, 3)
        b["latency_count"] += 1
        if latency_ms > b["max_latency_ms"]:
            b["max_latency_ms"] = round(latency_ms, 3)

    return sorted(buckets.values(), key=lambda x: (x["bucket_epoch"], x["host"]))


def push_metrics(
    *,
    backend_url: str,
    gateway_id: str,
    gateway_secret: str,
    buckets: list[dict],
    heartbeat_hosts: list[str],
    timeout_sec: float = 5.0,
) -> dict:
    payload = {
        "gateway_id": gateway_id,
        "buckets": buckets,
        "heartbeat_hosts": heartbeat_hosts,
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ts = str(int(time.time()))
    sig = sign_batch(gateway_id, gateway_secret, ts, raw)
    req = urllib.request.Request(
        f"{backend_url.rstrip('/')}/api/ingest/gateway-metrics",
        data=raw,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Gateway-Id": gateway_id,
            "X-Gateway-Timestamp": ts,
            "X-Matched-Domain": "__batch__",
            "X-Gateway-Signature": sig,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Aggregate Nginx JSON metrics log and push to Django.")
    parser.add_argument(
        "--log-path",
        default=os.environ.get("ZHAOHUI_METRICS_LOG_PATH", "/var/log/nginx/jszhff.cn.metrics.log"),
    )
    parser.add_argument(
        "--state-file",
        default=os.environ.get(
            "ZHAOHUI_AGGREGATOR_STATE_FILE", "/var/lib/zhaohui-admin/log-aggregator-state.json"
        ),
    )
    parser.add_argument(
        "--hosts",
        default=os.environ.get("ZHAOHUI_ALLOWED_DOMAINS", "jszhff.cn"),
        help="Comma-separated active domains for aggregation & heartbeats",
    )
    parser.add_argument(
        "--backend-url",
        default=os.environ.get("ZHAOHUI_BACKEND_URL", "http://127.0.0.1:18000"),
    )
    parser.add_argument(
        "--gateway-id",
        default=os.environ.get("ZHAOHUI_GATEWAY_ID", "prod-zhaohui-nginx-01"),
    )
    parser.add_argument(
        "--gateway-secret",
        default=os.environ.get("ZHAOHUI_GATEWAY_SECRET", ""),
    )
    parser.add_argument("--dry-run", action="store_true", help="Parse and print buckets without posting or saving offset")
    args = parser.parse_args()

    allowed_hosts = [h.strip().lower() for h in args.hosts.split(",") if h.strip()]
    log_path = Path(args.log_path)
    state_file = Path(args.state_file)
    state = load_state(state_file)

    lines, new_inode, new_offset = read_incremental_lines(log_path, state)
    buckets = aggregate_lines(lines, set(allowed_hosts))

    if args.dry_run:
        print(
            json.dumps(
                {
                    "dry_run": True,
                    "lines_read": len(lines),
                    "new_inode": new_inode,
                    "new_offset": new_offset,
                    "heartbeat_hosts": allowed_hosts,
                    "buckets": buckets,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return

    if not args.gateway_secret:
        sys.stderr.write("[log-aggregator] ERROR: ZHAOHUI_GATEWAY_SECRET is required.\n")
        sys.exit(2)

    try:
        res = push_metrics(
            backend_url=args.backend_url,
            gateway_id=args.gateway_id,
            gateway_secret=args.gateway_secret,
            buckets=buckets,
            heartbeat_hosts=allowed_hosts,
        )
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
        # Do NOT advance offset on failure so no requests are lost if Django is restarting
        sys.stderr.write(f"[log-aggregator] WARN: push failed (offset preserved): {exc}\n")
        sys.exit(1)

    save_state(state_file, new_inode, new_offset)
    print(
        f"[log-aggregator] ok lines={len(lines)} buckets={len(buckets)} "
        f"accepted={res.get('accepted', 0)} ignored={res.get('ignored', 0)} offset={new_offset}"
    )


if __name__ == "__main__":
    main()
