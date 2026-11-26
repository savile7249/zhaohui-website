#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

detect_mariadb_binaries

mkdir -p "${MARIADB_DATA_DIR}" "${MARIADB_RUN_DIR}" "${MARIADB_LOG_DIR}"

if [[ ! -d "${MARIADB_DATA_DIR}/mysql" ]]; then
  echo "[mariadb] 初始化隔离数据目录：${MARIADB_DATA_DIR}"
  "${MARIADB_INSTALL_DB_BIN}" \
    --basedir="${MARIADB_BASEDIR}" \
    --datadir="${MARIADB_DATA_DIR}" \
    --auth-root-authentication-method=normal \
    --skip-test-db >/dev/null
fi

if [[ -f "${MARIADB_PID}" ]] && kill -0 "$(cat "${MARIADB_PID}")" 2>/dev/null; then
  echo "[mariadb] 隔离实例已在运行 (PID $(cat "${MARIADB_PID}"), 127.0.0.1:${ZHAOHUI_DB_PORT})"
else
  echo "[mariadb] 启动用户态隔离实例 127.0.0.1:${ZHAOHUI_DB_PORT} ..."
  nohup "${MARIADBD_BIN}" \
    --no-defaults \
    --basedir="${MARIADB_BASEDIR}" \
    --datadir="${MARIADB_DATA_DIR}" \
    --socket="${MARIADB_SOCK}" \
    --pid-file="${MARIADB_PID}" \
    --log-error="${MARIADB_LOG_DIR}/error.log" \
    --bind-address=127.0.0.1 \
    --port="${ZHAOHUI_DB_PORT}" \
    --character-set-server=utf8mb4 \
    --collation-server=utf8mb4_unicode_ci \
    --innodb-buffer-pool-size=128M \
    --max-connections=64 \
    --skip-name-resolve \
    >/dev/null 2>&1 &

  if ! wait_for_tcp 127.0.0.1 "${ZHAOHUI_DB_PORT}" 30; then
    echo "[ERROR] MariaDB 未能在 127.0.0.1:${ZHAOHUI_DB_PORT} 就绪，请检查 ${MARIADB_LOG_DIR}/error.log" >&2
    tail -n 30 "${MARIADB_LOG_DIR}/error.log" >&2 || true
    exit 1
  fi
fi

"${MARIADB_CLIENT_BIN}" --socket="${MARIADB_SOCK}" -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${ZHAOHUI_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${ZHAOHUI_DB_USER}'@'127.0.0.1' IDENTIFIED BY '${ZHAOHUI_DB_PASSWORD}';
CREATE USER IF NOT EXISTS '${ZHAOHUI_DB_USER}'@'localhost' IDENTIFIED BY '${ZHAOHUI_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${ZHAOHUI_DB_NAME}\`.* TO '${ZHAOHUI_DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${ZHAOHUI_DB_NAME}\`.* TO '${ZHAOHUI_DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${ZHAOHUI_TEST_DB_NAME}\`.* TO '${ZHAOHUI_DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${ZHAOHUI_TEST_DB_NAME}\`.* TO '${ZHAOHUI_DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

echo "[mariadb] 就绪：127.0.0.1:${ZHAOHUI_DB_PORT} / DB=${ZHAOHUI_DB_NAME} / PID=$(cat "${MARIADB_PID}")"
