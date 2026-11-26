#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ADMIN_DIR="${REPO_ROOT}/admin-platform"
VENV_PY="${ADMIN_DIR}/.venv/bin/python"
VENV_GUNICORN="${ADMIN_DIR}/.venv/bin/gunicorn"

export ZHAOHUI_RUNTIME_DIR="${ZHAOHUI_RUNTIME_DIR:-${REPO_ROOT}/.local-test-env}"
export ZHAOHUI_DB_NAME="${ZHAOHUI_DB_NAME:-zhaohui_admin_test}"
export ZHAOHUI_TEST_DB_NAME="${ZHAOHUI_TEST_DB_NAME:-test_zhaohui_admin_test}"
export ZHAOHUI_DB_USER="${ZHAOHUI_DB_USER:-zhaohui_app}"
export ZHAOHUI_DB_PASSWORD="${ZHAOHUI_DB_PASSWORD:-ZhDb@Test2026!#99}"
export ZHAOHUI_DB_HOST="${ZHAOHUI_DB_HOST:-127.0.0.1}"
export ZHAOHUI_DB_PORT="${ZHAOHUI_DB_PORT:-13306}"
export ZHAOHUI_DJANGO_PORT="${ZHAOHUI_DJANGO_PORT:-18000}"
export ZHAOHUI_GATEWAY_HTTP_PORT="${ZHAOHUI_GATEWAY_HTTP_PORT:-18080}"
export ZHAOHUI_GATEWAY_HTTPS_PORT="${ZHAOHUI_GATEWAY_HTTPS_PORT:-18443}"
export ZHAOHUI_GATEWAY_ID="${ZHAOHUI_GATEWAY_ID:-local-test-gw-01}"
export ZHAOHUI_GATEWAY_SECRET="${ZHAOHUI_GATEWAY_SECRET:-a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff01}"

MARIADB_DATA_DIR="${ZHAOHUI_RUNTIME_DIR}/mariadb/data"
MARIADB_RUN_DIR="${ZHAOHUI_RUNTIME_DIR}/mariadb/run"
MARIADB_LOG_DIR="${ZHAOHUI_RUNTIME_DIR}/mariadb/logs"
MARIADB_SOCK="${MARIADB_RUN_DIR}/mariadb.sock"
MARIADB_PID="${MARIADB_RUN_DIR}/mariadb.pid"
PIDS_DIR="${ZHAOHUI_RUNTIME_DIR}/pids"
LOGS_DIR="${ZHAOHUI_RUNTIME_DIR}/logs"
CERTS_DIR="${ZHAOHUI_RUNTIME_DIR}/certs"

detect_mariadb_binaries() {
  local cache_root="${HOME}/.cache/zhaohui-mariadb"
  local candidate=""
  if [[ -d "${cache_root}" ]]; then
    candidate="$(find "${cache_root}" -maxdepth 1 -mindepth 1 -type d -name 'mariadb-*' 2>/dev/null | sort -V | tail -n 1 || true)"
  fi
  if [[ -n "${candidate}" && -x "${candidate}/bin/mariadbd" ]]; then
    MARIADB_BASEDIR="${candidate}"
    MARIADB_BIN_DIR="${candidate}/bin"
    MARIADB_SCRIPTS_DIR="${candidate}/scripts"
  elif command -v mariadbd >/dev/null 2>&1; then
    MARIADB_BIN_DIR="$(dirname "$(command -v mariadbd)")"
    MARIADB_BASEDIR="$(cd "${MARIADB_BIN_DIR}/.." && pwd)"
    MARIADB_SCRIPTS_DIR="${MARIADB_BIN_DIR}"
  else
    echo "[ERROR] 未找到 MariaDB 服务端 (mariadbd)。请检查 ~/.cache/zhaohui-mariadb/ 或 PATH。" >&2
    return 1
  fi

  MARIADBD_BIN="${MARIADB_BIN_DIR}/mariadbd"
  MARIADB_CLIENT_BIN="${MARIADB_BIN_DIR}/mariadb"
  MARIADB_ADMIN_BIN="${MARIADB_BIN_DIR}/mariadb-admin"
  MARIADB_DUMP_BIN="${MARIADB_BIN_DIR}/mariadb-dump"
  if [[ -x "${MARIADB_SCRIPTS_DIR}/mariadb-install-db" ]]; then
    MARIADB_INSTALL_DB_BIN="${MARIADB_SCRIPTS_DIR}/mariadb-install-db"
  elif [[ -x "${MARIADB_BIN_DIR}/mariadb-install-db" ]]; then
    MARIADB_INSTALL_DB_BIN="${MARIADB_BIN_DIR}/mariadb-install-db"
  else
    MARIADB_INSTALL_DB_BIN="$(command -v mariadb-install-db || true)"
  fi
  export MARIADB_BASEDIR MARIADB_BIN_DIR MARIADBD_BIN MARIADB_CLIENT_BIN MARIADB_ADMIN_BIN MARIADB_DUMP_BIN MARIADB_INSTALL_DB_BIN
}

wait_for_tcp() {
  local host="$1"
  local port="$2"
  local timeout="${3:-30}"
  local i=0
  while (( i < timeout * 4 )); do
    if "${VENV_PY}" -c "import socket; s=socket.create_connection(('${host}', ${port}), 0.5); s.close()" 2>/dev/null; then
      return 0
    fi
    sleep 0.25
    i=$((i + 1))
  done
  return 1
}
