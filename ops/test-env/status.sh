#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

check_proc() {
  local name="$1"
  local pid_file="$2"
  local port="$3"
  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      local rss_kb cpu
      rss_kb="$(ps -o rss= -p "${pid}" 2>/dev/null | tr -d ' ' || echo 0)"
      cpu="$(ps -o %cpu= -p "${pid}" 2>/dev/null | tr -d ' ' || echo 0)"
      local child_rss=0
      for cpid in $(pgrep -P "${pid}" 2>/dev/null || true); do
        local cr
        cr="$(ps -o rss= -p "${cpid}" 2>/dev/null | tr -d ' ' || echo 0)"
        child_rss=$((child_rss + cr))
      done
      local total_mb
      total_mb="$(awk "BEGIN {printf \"%.1f\", (${rss_kb} + ${child_rss}) / 1024}")"
      echo "[UP]   ${name} | PID=${pid} | Port=${port} | RSS=${total_mb} MiB | CPU=${cpu}%"
      return 0
    fi
  fi
  echo "[DOWN] ${name} | Port=${port}"
  return 1
}

echo "=== 本地隔离测试环境状态 ==="
check_proc "MariaDB" "${MARIADB_PID}" "127.0.0.1:${ZHAOHUI_DB_PORT}" || true
check_proc "Django" "${PIDS_DIR}/django.pid" "127.0.0.1:${ZHAOHUI_DJANGO_PORT}" || true
check_proc "Gateway" "${PIDS_DIR}/gateway.pid" "127.0.0.1:${ZHAOHUI_GATEWAY_HTTP_PORT}/${ZHAOHUI_GATEWAY_HTTPS_PORT}" || true
if [[ -d "${ZHAOHUI_RUNTIME_DIR}" ]]; then
  echo "运行目录磁盘占用：$(du -sh "${ZHAOHUI_RUNTIME_DIR}" | awk '{print $1}') (${ZHAOHUI_RUNTIME_DIR})"
fi
