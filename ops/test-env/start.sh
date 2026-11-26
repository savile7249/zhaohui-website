#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

mkdir -p "${PIDS_DIR}" "${LOGS_DIR}" "${CERTS_DIR}" "${ZHAOHUI_RUNTIME_DIR}/sites" "${ZHAOHUI_RUNTIME_DIR}/snapshots" "${ZHAOHUI_RUNTIME_DIR}/backups"

# 1. Start isolated MariaDB
bash "${SCRIPT_DIR}/init_mariadb.sh"

# 2. Generate local CA + TLS certificates (normal 365d cert) if missing
if [[ ! -f "${CERTS_DIR}/server.crt" || ! -f "${CERTS_DIR}/local-ca.pem" ]]; then
  "${VENV_PY}" "${SCRIPT_DIR}/gen_certs.py" --certs-dir "${CERTS_DIR}" --days 365 --prefix server
fi

# 3. Django migrations, static files, and idempotent test seed
(
  cd "${ADMIN_DIR}"
  "${VENV_PY}" manage.py migrate --noinput
  "${VENV_PY}" manage.py collectstatic --noinput >/dev/null
  "${VENV_PY}" manage.py seed_test_env
)

# 4. Ensure initial static releases exist for active domains (and preview for pending_icp)
"${VENV_PY}" - <<PY
import os, sys
sys.path.insert(0, "${ADMIN_DIR}")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
from django.contrib.auth import get_user_model
from core.models import Domain, Site
from publishing.models import ReleaseRecord
from publishing.pipeline import build_and_deploy_domain

User = get_user_model()
admin = User.objects.get(username="platform_admin")

for site in Site.objects.all():
    snap = site.snapshots.order_by("id").first()
    if not snap:
        continue
    for dom in site.domains.all():
        if dom.domain_status == Domain.STATUS_ACTIVE:
            if not dom.releases.filter(is_current=True, status=ReleaseRecord.STATUS_SUCCEEDED).exists():
                print(f"[init-release] Building initial release for {dom.official_domain} ({dom.test_host})...")
                rel = build_and_deploy_domain(snapshot=snap, domain=dom, build_type=ReleaseRecord.BUILD_RELEASE, user=admin)
                assert rel.status == ReleaseRecord.STATUS_SUCCEEDED, rel.error_message
        if not dom.releases.filter(build_type=ReleaseRecord.BUILD_PREVIEW, status=ReleaseRecord.STATUS_SUCCEEDED).exists():
            print(f"[init-preview] Building initial preview for {dom.official_domain} ({dom.preview_host})...")
            rel = build_and_deploy_domain(snapshot=snap, domain=dom, build_type=ReleaseRecord.BUILD_PREVIEW, user=admin)
            assert rel.status == ReleaseRecord.STATUS_SUCCEEDED, rel.error_message
PY

# 5. Start Django (Gunicorn) on 127.0.0.1:18000
if [[ -f "${PIDS_DIR}/django.pid" ]] && kill -0 "$(cat "${PIDS_DIR}/django.pid")" 2>/dev/null; then
  echo "[django] 已在运行 (PID $(cat "${PIDS_DIR}/django.pid"))"
else
  echo "[django] 启动 Gunicorn 127.0.0.1:${ZHAOHUI_DJANGO_PORT} ..."
  (
    cd "${ADMIN_DIR}"
    nohup "${VENV_GUNICORN}" config.wsgi:application \
      --bind "127.0.0.1:${ZHAOHUI_DJANGO_PORT}" \
      --workers 2 \
      --threads 4 \
      --timeout 180 \
      --pid "${PIDS_DIR}/django.pid" \
      --access-logfile "${LOGS_DIR}/django-access.log" \
      --error-logfile "${LOGS_DIR}/django-error.log" \
      >/dev/null 2>&1 &
  )
  if ! wait_for_tcp 127.0.0.1 "${ZHAOHUI_DJANGO_PORT}" 20; then
    echo "[ERROR] Django 未能在 127.0.0.1:${ZHAOHUI_DJANGO_PORT} 就绪" >&2
    tail -n 30 "${LOGS_DIR}/django-error.log" >&2 || true
    exit 1
  fi
fi

# 6. Start Local Isolated Trusted Gateway (HTTP 18080 / HTTPS 18443)
if [[ -f "${PIDS_DIR}/gateway.pid" ]] && kill -0 "$(cat "${PIDS_DIR}/gateway.pid")" 2>/dev/null; then
  echo "[gateway] 已在运行 (PID $(cat "${PIDS_DIR}/gateway.pid"))"
else
  echo "[gateway] 启动本地隔离测试网关 HTTP:${ZHAOHUI_GATEWAY_HTTP_PORT} HTTPS:${ZHAOHUI_GATEWAY_HTTPS_PORT} ..."
  nohup "${VENV_PY}" "${ADMIN_DIR}/gateway/server.py" >"${LOGS_DIR}/gateway.log" 2>&1 &
  echo $! >"${PIDS_DIR}/gateway.pid"
  if ! wait_for_tcp 127.0.0.1 "${ZHAOHUI_GATEWAY_HTTP_PORT}" 15; then
    echo "[ERROR] 测试网关未能在 127.0.0.1:${ZHAOHUI_GATEWAY_HTTP_PORT} 就绪" >&2
    tail -n 30 "${LOGS_DIR}/gateway.log" >&2 || true
    exit 1
  fi
fi

# 7. Flush gateway heartbeat & run initial external probe
curl -fsS -X POST "http://127.0.0.1:${ZHAOHUI_GATEWAY_HTTP_PORT}/_gateway/flush" >/dev/null || true
(cd "${ADMIN_DIR}" && "${VENV_PY}" manage.py run_probes)

echo ""
echo "=== 本地隔离测试环境已就绪 ==="
echo "运营总览与登录 : http://127.0.0.1:${ZHAOHUI_DJANGO_PORT}/overview/"
echo "Django Admin   : http://127.0.0.1:${ZHAOHUI_DJANGO_PORT}/admin/"
echo "兆辉主域测试页 : http://jszhff.localhost:${ZHAOHUI_GATEWAY_HTTP_PORT}/  (HTTPS: https://jszhff.localhost:${ZHAOHUI_GATEWAY_HTTPS_PORT}/)"
echo "兆辉待备案预览 : http://preview-zhaohuifangfu.localhost:${ZHAOHUI_GATEWAY_HTTP_PORT}/"
echo "模拟独立测试站 : http://sim-site.localhost:${ZHAOHUI_GATEWAY_HTTP_PORT}/"
echo "MariaDB 隔离库 : 127.0.0.1:${ZHAOHUI_DB_PORT} (DB=${ZHAOHUI_DB_NAME})"
