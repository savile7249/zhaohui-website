#!/usr/bin/env bash
# Daily MariaDB logical backup for isolated `zhaohui_admin` database.
# Triggered by systemd timer `zhaohui-db-backup.timer` (03:15 CST daily).
# Credentials are read from /etc/zhaohui-admin/backup.my.cnf (chmod 600, NOT in git).

set -euo pipefail

BACKUP_DIR="${ZHAOHUI_BACKUPS_ROOT:-/var/backups/zhaohui-admin}"
DB_NAME="${ZHAOHUI_DB_NAME:-zhaohui_admin}"
DEFAULTS_FILE="${ZHAOHUI_BACKUP_CNF:-/etc/zhaohui-admin/backup.my.cnf}"
KEEP_DAYS="${ZHAOHUI_BACKUP_KEEP_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"
chmod 750 "${BACKUP_DIR}"

TS="$(date +%Y%m%d-%H%M%S)"
OUT_GZ="${BACKUP_DIR}/${DB_NAME}-${TS}.sql.gz"
TMP_GZ="${OUT_GZ}.tmp"
SHA_FILE="${OUT_GZ}.sha256"

if [[ -f "${DEFAULTS_FILE}" ]]; then
  DUMP_AUTH=(--defaults-extra-file="${DEFAULTS_FILE}")
else
  # Fallback when invoked directly as root over unix_socket
  DUMP_AUTH=()
fi

mariadb-dump "${DUMP_AUTH[@]}" \
  --single-transaction \
  --routines \
  --triggers \
  --hex-blob \
  --databases "${DB_NAME}" \
  | gzip -9 > "${TMP_GZ}"

# Verify non-empty valid gzip archive
gzip -t "${TMP_GZ}"
mv -f "${TMP_GZ}" "${OUT_GZ}"
chmod 640 "${OUT_GZ}"

(
  cd "${BACKUP_DIR}"
  sha256sum "$(basename "${OUT_GZ}")" > "$(basename "${SHA_FILE}")"
  chmod 640 "$(basename "${SHA_FILE}")"
)

# Prune old local backups beyond KEEP_DAYS
find "${BACKUP_DIR}" -maxdepth 1 -type f \( -name "${DB_NAME}-*.sql.gz" -o -name "${DB_NAME}-*.sql.gz.sha256" \) -mtime "+${KEEP_DAYS}" -delete

SIZE_BYTES="$(stat -c '%s' "${OUT_GZ}")"
echo "[backup] OK: ${OUT_GZ} (${SIZE_BYTES} bytes), sha256=$(cut -d' ' -f1 "${SHA_FILE}")"
