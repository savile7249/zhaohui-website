#!/usr/bin/env bash
# ==============================================================================
# Zero-Downtime Atomic Rollback Script for `/var/www/jszhff.cn`
# ------------------------------------------------------------------------------
# Runs directly on origin server `zhaohui` (works even if Django/Gunicorn is down!).
#
# Usage:
#   # List available historical releases and show current active target:
#   bash ops/prod-pilot/rollback_prod.sh --list
#
#   # Atomically roll back to a specific release version:
#   bash ops/prod-pilot/rollback_prod.sh --version 20261126-143000
# ==============================================================================

set -euo pipefail

DOMAIN="jszhff.cn"
SITE_BASE="/var/www/jszhff.cn"
ACTION="list"
TARGET_VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list) ACTION="list"; shift ;;
    --version) ACTION="rollback"; TARGET_VERSION="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; SITE_BASE="/var/www/$2"; shift 2 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ ! -d "${SITE_BASE}/releases" ]]; then
  echo "[ERROR] Releases directory not found: ${SITE_BASE}/releases" >&2
  exit 1
fi

CURRENT_TARGET="$(readlink -f "${SITE_BASE}/current" 2>/dev/null || echo 'NONE')"

if [[ "${ACTION}" == "list" ]]; then
  echo "Domain  : ${DOMAIN}"
  echo "Current : ${CURRENT_TARGET}"
  echo "Releases (newest first):"
  ls -lt "${SITE_BASE}/releases"
  exit 0
fi

if [[ -z "${TARGET_VERSION}" ]]; then
  echo "[ERROR] --version is required for rollback." >&2
  exit 2
fi

TARGET_DIR="${SITE_BASE}/releases/${TARGET_VERSION}"
if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "[ERROR] Target release directory does not exist: ${TARGET_DIR}" >&2
  exit 1
fi

# Pre-switch integrity check
for req_file in \
  "index.html" \
  "404.html" \
  "products/tanks/index.html" \
  "products/reactors/index.html" \
  "products/towers/index.html" \
  "products/piping/index.html"; do
  if [[ ! -f "${TARGET_DIR}/${req_file}" ]]; then
    echo "[ERROR] Target release incomplete, missing: ${TARGET_DIR}/${req_file}" >&2
    exit 1
  fi
done

echo "[rollback] Previous target : ${CURRENT_TARGET}"
echo "[rollback] Switching to    : ${TARGET_DIR}"

# Atomic symlink swap (zero 404 window)
ln -sfn "releases/${TARGET_VERSION}" "${SITE_BASE}/.current.rollback"
mv -Tf "${SITE_BASE}/.current.rollback" "${SITE_BASE}/current"

echo "[rollback] Active symlink  : $(readlink -f "${SITE_BASE}/current")"

# Post-rollback verification against local Nginx with SNI
for path in "/" "/products/tanks/" "/products/reactors/" "/products/towers/" "/products/piping/"; do
  code="$(curl -fsS --resolve "${DOMAIN}:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://${DOMAIN}${path}")"
  echo "[verify] GET https://${DOMAIN}${path} -> HTTP ${code}"
  if [[ "${code}" != "200" ]]; then
    echo "[ERROR] Post-rollback verification failed on ${path} (HTTP ${code})" >&2
    exit 1
  fi
done

echo "[rollback] SUCCESS: ${DOMAIN} rolled back atomically to ${TARGET_VERSION}."
