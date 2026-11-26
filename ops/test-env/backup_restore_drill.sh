#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

detect_mariadb_binaries

mkdir -p "${ZHAOHUI_RUNTIME_DIR}/backups"
TS="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${ZHAOHUI_RUNTIME_DIR}/backups/${ZHAOHUI_DB_NAME}-${TS}.sql"

echo "[drill] 1/5 记录备份前基线行数与受管数据..."
BEFORE_SUMMARY="$("${MARIADB_CLIENT_BIN}" --socket="${MARIADB_SOCK}" -u root -N -B "${ZHAOHUI_DB_NAME}" -e "
SELECT 'sites', COUNT(*) FROM core_site
UNION ALL SELECT 'domains', COUNT(*) FROM core_domain
UNION ALL SELECT 'events', COUNT(*) FROM monitoring_pageevent
UNION ALL SELECT 'products', COUNT(*) FROM publishing_managedproduct
UNION ALL SELECT 'releases', COUNT(*) FROM publishing_releaserecord
UNION ALL SELECT 'audits', COUNT(*) FROM core_auditlog;
")"
echo "${BEFORE_SUMMARY}"

echo "[drill] 2/5 使用 mariadb-dump 执行全库逻辑备份：${DUMP_FILE}"
"${MARIADB_DUMP_BIN}" \
  --socket="${MARIADB_SOCK}" \
  -u root \
  --single-transaction \
  --routines \
  --triggers \
  --hex-blob \
  --databases "${ZHAOHUI_DB_NAME}" \
  >"${DUMP_FILE}"

DUMP_SIZE="$(stat -c%s "${DUMP_FILE}")"
DUMP_SHA="$(sha256sum "${DUMP_FILE}" | awk '{print $1}')"
echo "[drill] 备份文件大小：${DUMP_SIZE} bytes | SHA-256：${DUMP_SHA}"

echo "[drill] 3/5 模拟故障：篡改受管产品名称并删除监测事件..."
"${MARIADB_CLIENT_BIN}" --socket="${MARIADB_SOCK}" -u root "${ZHAOHUI_DB_NAME}" -e "
UPDATE publishing_managedproduct SET display_name = 'CORRUPTED_SIMULATION' WHERE slug = 'tanks';
DELETE FROM monitoring_pageevent;
"
CORRUPTED_CHECK="$("${MARIADB_CLIENT_BIN}" --socket="${MARIADB_SOCK}" -u root -N -B "${ZHAOHUI_DB_NAME}" -e "
SELECT display_name, (SELECT COUNT(*) FROM monitoring_pageevent) FROM publishing_managedproduct WHERE slug = 'tanks' LIMIT 1;
")"
echo "[drill] 模拟损坏后状态：${CORRUPTED_CHECK}"

echo "[drill] 4/5 从全库备份恢复..."
"${MARIADB_CLIENT_BIN}" --socket="${MARIADB_SOCK}" -u root <"${DUMP_FILE}"

echo "[drill] 5/5 校验恢复后行数与数据一致性..."
AFTER_SUMMARY="$("${MARIADB_CLIENT_BIN}" --socket="${MARIADB_SOCK}" -u root -N -B "${ZHAOHUI_DB_NAME}" -e "
SELECT 'sites', COUNT(*) FROM core_site
UNION ALL SELECT 'domains', COUNT(*) FROM core_domain
UNION ALL SELECT 'events', COUNT(*) FROM monitoring_pageevent
UNION ALL SELECT 'products', COUNT(*) FROM publishing_managedproduct
UNION ALL SELECT 'releases', COUNT(*) FROM publishing_releaserecord
UNION ALL SELECT 'audits', COUNT(*) FROM core_auditlog;
")"
echo "${AFTER_SUMMARY}"

if [[ "${BEFORE_SUMMARY}" != "${AFTER_SUMMARY}" ]]; then
  echo "[ERROR] 备份恢复前后统计不一致！" >&2
  exit 1
fi

RESTORED_TANKS="$("${MARIADB_CLIENT_BIN}" --socket="${MARIADB_SOCK}" -u root -N -B "${ZHAOHUI_DB_NAME}" -e "
SELECT display_name FROM publishing_managedproduct WHERE slug = 'tanks' LIMIT 1;
")"
if [[ "${RESTORED_TANKS}" == "CORRUPTED_SIMULATION" ]]; then
  echo "[ERROR] 受管产品数据未恢复！" >&2
  exit 1
fi

echo "[drill] PASS: MariaDB 全库备份与灾难恢复演练完全一致（tanks=${RESTORED_TANKS}）。"
