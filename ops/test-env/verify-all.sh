#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

SCREENSHOTS_DIR="${SCREENSHOTS_DIR:-/home/savil/Artifacts/zhaohui-multisite-v1-test/screenshots}"
export SCREENSHOTS_DIR REPO_ROOT

echo "============================================================"
echo " 兆辉多域名网站监测与管理后台 v1.0 全阶段端到端复验"
echo "============================================================"

# 1. Start isolated test environment
bash "${SCRIPT_DIR}/start.sh"

# 2. Run Django unit/integration test suite against REAL isolated MariaDB test database
echo ""
echo "[STEP 1/5] 运行 Django 全量自动化测试（真实隔离 MariaDB 测试库）..."
(
  cd "${ADMIN_DIR}"
  "${VENV_PY}" manage.py test core --noinput --verbosity=2
)

# 3. Run live Playwright E2E verification across Stages 1, 2, 3 + screenshot capture
echo ""
echo "[STEP 2/5] 运行 Playwright 浏览器端到端验证与截图采集..."
node "${SCRIPT_DIR}/e2e_verify.mjs"

# 4. Admin Downtime Verification: stop Django Admin, verify static site stays 200 OK, then restart Django
echo ""
echo "[STEP 3/5] 后台停机可用性验证（停止 Django Admin 后官网静态页持续可用）..."
DJANGO_PID="$(cat "${PIDS_DIR}/django.pid")"
kill "${DJANGO_PID}"
sleep 1.5
if curl -fsS "http://127.0.0.1:${ZHAOHUI_DJANGO_PORT}/login/" >/dev/null 2>&1; then
  echo "[ERROR] Django 未停止" >&2
  exit 1
fi
echo "[downtime] 确认 Django Admin (127.0.0.1:${ZHAOHUI_DJANGO_PORT}) 已停机"

for check_url in \
  "http://jszhff.localhost:${ZHAOHUI_GATEWAY_HTTP_PORT}/" \
  "http://jszhff.localhost:${ZHAOHUI_GATEWAY_HTTP_PORT}/products/tanks/" \
  "http://sim-site.localhost:${ZHAOHUI_GATEWAY_HTTP_PORT}/"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${check_url}")"
  echo "[downtime] GET ${check_url} -> HTTP ${code}"
  if [[ "${code}" != "200" ]]; then
    echo "[ERROR] 后台停机期间静态页不可访问：${check_url} (${code})" >&2
    exit 1
  fi
done
echo "[downtime] PASS: Django Admin 停机期间，兆辉主域与模拟独立站静态页均 100% 正常访问。"

# Restart Django cleanly
rm -f "${PIDS_DIR}/django.pid"
bash "${SCRIPT_DIR}/start.sh" >/dev/null

# 5. MariaDB Backup & Restore Drill
echo ""
echo "[STEP 4/5] 运行 MariaDB 全库备份与灾难恢复演练..."
bash "${SCRIPT_DIR}/backup_restore_drill.sh"

# 6. Resource Profiling under test load
echo ""
echo "[STEP 5/5] 测试负载下采集 CPU / 内存 RSS / 磁盘占用..."
"${VENV_PY}" - <<PY
import json, os, subprocess, time, urllib.request
from pathlib import Path

runtime_dir = Path("${ZHAOHUI_RUNTIME_DIR}")
gw_http = "${ZHAOHUI_GATEWAY_HTTP_PORT}"
dj_port = "${ZHAOHUI_DJANGO_PORT}"

# Generate realistic test burst (60 static + 20 django requests)
t0 = time.monotonic()
for _ in range(30):
    urllib.request.urlopen(f"http://jszhff.localhost:{gw_http}/", timeout=5).read()
    urllib.request.urlopen(f"http://sim-site.localhost:{gw_http}/", timeout=5).read()
for _ in range(20):
    urllib.request.urlopen(f"http://127.0.0.1:{dj_port}/login/", timeout=5).read()
urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{gw_http}/_gateway/flush", method="POST"), timeout=5).read()
elapsed = round(time.monotonic() - t0, 2)

def measure_tree(pid_file: Path):
    if not pid_file.is_file():
        return {"running": False}
    root_pid = int(pid_file.read_text().strip())
    pids = [root_pid]
    try:
        out = subprocess.check_output(["pgrep", "-P", str(root_pid)], text=True).strip()
        if out:
            pids.extend(int(x) for x in out.splitlines() if x.strip())
    except subprocess.CalledProcessError:
        pass
    total_rss_kb = 0
    total_cpu = 0.0
    for p in pids:
        try:
            line = subprocess.check_output(["ps", "-o", "rss=,%cpu=", "-p", str(p)], text=True).strip()
            parts = line.split()
            if len(parts) >= 2:
                total_rss_kb += int(parts[0])
                total_cpu += float(parts[1])
        except Exception:
            pass
    return {
        "running": True,
        "root_pid": root_pid,
        "process_count": len(pids),
        "rss_mib": round(total_rss_kb / 1024.0, 2),
        "cpu_pct": round(total_cpu, 2),
    }

def dir_mb(p: Path):
    if not p.exists():
        return 0.0
    out = subprocess.check_output(["du", "-sk", str(p)], text=True).split()[0]
    return round(int(out) / 1024.0, 2)

profile = {
    "measured_at": time.strftime("%Y-%m-%d %H:%M:%S %Z"),
    "load_burst_seconds": elapsed,
    "load_description": "60 static gateway requests + 20 Django requests + metrics flush",
    "processes": {
        "mariadb": measure_tree(runtime_dir / "mariadb" / "run" / "mariadb.pid"),
        "django_gunicorn": measure_tree(runtime_dir / "pids" / "django.pid"),
        "local_gateway": measure_tree(runtime_dir / "pids" / "gateway.pid"),
    },
    "disk_mib": {
        "mariadb_data": dir_mb(runtime_dir / "mariadb" / "data"),
        "published_sites": dir_mb(runtime_dir / "sites"),
        "backups": dir_mb(runtime_dir / "backups"),
        "total_runtime_dir": dir_mb(runtime_dir),
    },
}
profile["total_rss_mib"] = round(
    sum(v.get("rss_mib", 0.0) for v in profile["processes"].values()), 2
)
out_file = runtime_dir / "resource-profile.json"
out_file.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(profile, ensure_ascii=False, indent=2))
PY

echo ""
bash "${SCRIPT_DIR}/status.sh"
echo ""
echo "============================================================"
echo " ALL 4 STAGES VERIFIED SUCCESSFULLY!"
echo "============================================================"
