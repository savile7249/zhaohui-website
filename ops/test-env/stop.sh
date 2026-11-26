#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

stop_pid_file() {
  local name="$1"
  local pid_file="$2"
  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      echo "[stop] 正在停止 ${name} (PID ${pid}) ..."
      kill "${pid}" 2>/dev/null || true
      local i=0
      while kill -0 "${pid}" 2>/dev/null && (( i < 40 )); do
        sleep 0.25
        i=$((i + 1))
      done
      if kill -0 "${pid}" 2>/dev/null; then
        kill -9 "${pid}" 2>/dev/null || true
      fi
    fi
    rm -f "${pid_file}"
  fi
}

stop_pid_file "gateway" "${PIDS_DIR}/gateway.pid"
stop_pid_file "django" "${PIDS_DIR}/django.pid"

if detect_mariadb_binaries 2>/dev/null && [[ -S "${MARIADB_SOCK}" ]]; then
  echo "[stop] 正在优雅关闭隔离 MariaDB ..."
  "${MARIADB_ADMIN_BIN}" --socket="${MARIADB_SOCK}" -u root shutdown 2>/dev/null || true
  sleep 1
fi
stop_pid_file "mariadb" "${MARIADB_PID}"

echo "[stop] 本地隔离测试环境已全部停止。"
