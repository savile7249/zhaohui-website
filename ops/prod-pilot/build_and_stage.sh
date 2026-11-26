#!/usr/bin/env bash
# ==============================================================================
# Offline/Local Build & Atomic Release Script for `jszhff.cn`
# ------------------------------------------------------------------------------
# Architecture invariant:
#   Next.js 16 static builds ALWAYS run on the local dev machine or CI — NEVER
#   on the 2 vCPU origin server (`zhaohui`). Only verified static artifacts are
#   synced to `/var/www/jszhff.cn/releases/<VERSION>` and switched atomically.
#
# Usage:
#   # 1. Local build & smoke verify only (no remote SSH writes):
#   bash ops/prod-pilot/build_and_stage.sh --local-only [--snapshot path/to/snap.json]
#
#   # 2. Stage to remote releases/<VERSION> WITHOUT switching `current` symlink:
#   bash ops/prod-pilot/build_and_stage.sh --stage-only --target zhaohui [--version 20261127-100000]
#
#   # 3. Build, verify, stage, AND atomically switch `/var/www/jszhff.cn/current`:
#   bash ops/prod-pilot/build_and_stage.sh --activate --target zhaohui [--keep-releases 5]
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

MODE="local-only"
SSH_TARGET="zhaohui"
DOMAIN="jszhff.cn"
REMOTE_BASE="/var/www/jszhff.cn"
VERSION="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT_PATH=""
KEEP_RELEASES=5
EXPECTED_ICP="苏ICP备20000966号-6"
EXPECTED_CANONICAL="https://jszhff.cn/"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local-only) MODE="local-only"; shift ;;
    --stage-only) MODE="stage-only"; shift ;;
    --activate) MODE="activate"; shift ;;
    --target) SSH_TARGET="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; REMOTE_BASE="/var/www/$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --snapshot) SNAPSHOT_PATH="$2"; shift 2 ;;
    --keep-releases) KEEP_RELEASES="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,22p' "$0"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

echo "[build] Repo root : ${REPO_ROOT}"
echo "[build] Mode      : ${MODE}"
echo "[build] Domain    : ${DOMAIN} (version=${VERSION})"

cd "${REPO_ROOT}"

# 1. Typecheck & Next.js static export locally
echo "[1/4] Running npm run typecheck..."
npm run typecheck

echo "[2/4] Running Next.js static export locally..."
rm -rf "${REPO_ROOT}/out"
if [[ -n "${SNAPSHOT_PATH}" ]]; then
  if [[ ! -f "${SNAPSHOT_PATH}" ]]; then
    echo "[ERROR] Snapshot file not found: ${SNAPSHOT_PATH}" >&2
    exit 1
  fi
  echo "[build] Using snapshot override: ${SNAPSHOT_PATH}"
  ZHAOHUI_SNAPSHOT_PATH="${SNAPSHOT_PATH}" NEXT_TELEMETRY_DISABLED=1 npm run build
else
  NEXT_TELEMETRY_DISABLED=1 npm run build
fi

# 2. Local artifact smoke verification (HTML, 4 products, ICP, canonical, 404, static assets)
echo "[3/4] Verifying exported static artifact in out/..."
OUT_DIR="${REPO_ROOT}/out"
for req_file in \
  "index.html" \
  "404.html" \
  "robots.txt" \
  "sitemap.xml" \
  "products/tanks/index.html" \
  "products/reactors/index.html" \
  "products/towers/index.html" \
  "products/piping/index.html"; do
  if [[ ! -f "${OUT_DIR}/${req_file}" ]]; then
    echo "[ERROR] Missing required export file: out/${req_file}" >&2
    exit 1
  fi
done

if ! grep -Fq "${EXPECTED_ICP}" "${OUT_DIR}/index.html"; then
  echo "[ERROR] Home page missing expected ICP number: ${EXPECTED_ICP}" >&2
  exit 1
fi
if ! grep -Fq "rel=\"canonical\" href=\"${EXPECTED_CANONICAL}\"" "${OUT_DIR}/index.html"; then
  echo "[ERROR] Home page missing expected canonical link: ${EXPECTED_CANONICAL}" >&2
  exit 1
fi

# Verify every local static asset referenced in index.html exists
python3 - "${OUT_DIR}" <<'PY'
import re, sys
from pathlib import Path
out_dir = Path(sys.argv[1])
html = (out_dir / "index.html").read_text(encoding="utf-8", errors="ignore")
refs = sorted(set(re.findall(r'(?:src|href)="(/[^\s"?#]+\.(?:css|js|webp|png|jpg|jpeg|svg|ico))"', html)))
missing = [r for r in refs if not (out_dir / r.lstrip("/")).is_file()]
if not refs or missing:
    print(f"[ERROR] Static asset check failed: count={len(refs)} missing={missing[:10]}", file=sys.stderr)
    sys.exit(1)
print(f"[smoke] Verified {len(refs)} referenced static assets in out/index.html (0 missing).")
PY

if [[ "${MODE}" == "local-only" ]]; then
  echo "[4/4] Local build and verification succeeded (--local-only, no remote changes)."
  exit 0
fi

# 3. Sync verified artifact to remote versioned release directory
REMOTE_RELEASE_DIR="${REMOTE_BASE}/releases/${VERSION}"
echo "[4/4] Syncing verified out/ -> ${SSH_TARGET}:${REMOTE_RELEASE_DIR}/ ..."
ssh -o BatchMode=yes "${SSH_TARGET}" "mkdir -p '${REMOTE_RELEASE_DIR}'"
rsync -az --delete "${OUT_DIR}/" "${SSH_TARGET}:${REMOTE_RELEASE_DIR}/"

# Preserve ACME challenge directory inside release if certbot webroot uses current
ssh -o BatchMode=yes "${SSH_TARGET}" "mkdir -p '${REMOTE_RELEASE_DIR}/.well-known/acme-challenge'"

if [[ "${MODE}" == "stage-only" ]]; then
  echo "[done] Staged release at ${SSH_TARGET}:${REMOTE_RELEASE_DIR} (current symlink unchanged)."
  exit 0
fi

# 4. Atomic symlink switch + live HTTP verification + release retention pruning
echo "[activate] Switching ${SSH_TARGET}:${REMOTE_BASE}/current -> releases/${VERSION} atomically..."
ssh -o BatchMode=yes "${SSH_TARGET}" bash -s -- "${REMOTE_BASE}" "${VERSION}" "${KEEP_RELEASES}" <<'EOF'
set -euo pipefail
REMOTE_BASE="$1"
VERSION="$2"
KEEP_RELEASES="$3"

TARGET_DIR="${REMOTE_BASE}/releases/${VERSION}"
if [[ ! -f "${TARGET_DIR}/index.html" ]]; then
  echo "[ERROR] Remote release missing index.html: ${TARGET_DIR}" >&2
  exit 1
fi

# Atomic symlink replacement via relative target matching existing layout: current -> releases/<VERSION>
ln -sfn "releases/${VERSION}" "${REMOTE_BASE}/.current.next"
mv -Tf "${REMOTE_BASE}/.current.next" "${REMOTE_BASE}/current"
echo "[activate] Current symlink now points to: $(readlink -f "${REMOTE_BASE}/current")"

# Retain latest KEEP_RELEASES directories (never delete the active target)
ACTIVE_NAME="$(basename "$(readlink -f "${REMOTE_BASE}/current")")"
mapfile -t OLD_RELEASES < <(ls -1t "${REMOTE_BASE}/releases" | tail -n "+$((KEEP_RELEASES + 1))")
for old in "${OLD_RELEASES[@]}"; do
  if [[ -n "${old}" && "${old}" != "${ACTIVE_NAME}" ]]; then
    echo "[prune] Removing old release: ${REMOTE_BASE}/releases/${old}"
    rm -rf "${REMOTE_BASE}/releases/${old}"
  fi
done
EOF

echo "[verify] Checking live HTTPS endpoints for https://${DOMAIN}/ ..."
for path in "/" "/products/tanks/" "/products/reactors/" "/products/towers/" "/products/piping/"; do
  code="$(curl -fsS -o /dev/null -w '%{http_code}' "https://${DOMAIN}${path}")"
  echo "[verify] GET https://${DOMAIN}${path} -> HTTP ${code}"
  if [[ "${code}" != "200" ]]; then
    echo "[ERROR] Live smoke check failed for ${path} (HTTP ${code})" >&2
    exit 1
  fi
done
echo "[done] Production release ${VERSION} activated and verified."
