#!/usr/bin/env bash
# 一键启动本地轻量化 SQLite 内容管理后台（无需配置 MariaDB）
# 启动后访问：http://127.0.0.1:18000/publishing/zhaohui/variants/
# 搭配本地前端：在另一终端运行 npm run dev（http://localhost:3000/）
# 在后台编辑参数或文章后，点击「同步到本地前端工作区（Dev Sync）」即可即时热更新前端页面。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ADMIN_DIR="${REPO_ROOT}/admin-platform"

if [[ -x "${ADMIN_DIR}/.venv/bin/python" ]]; then
  PY_BIN="${ADMIN_DIR}/.venv/bin/python"
elif [[ -n "${ZHAOHUI_PYTHON:-}" && -x "${ZHAOHUI_PYTHON}" ]]; then
  PY_BIN="${ZHAOHUI_PYTHON}"
else
  PY_BIN="$(command -v python3)"
fi

export ZHAOHUI_ENV="test"
export ZHAOHUI_DB_ENGINE="sqlite"
export ZHAOHUI_RUNTIME_DIR="${ZHAOHUI_RUNTIME_DIR:-${REPO_ROOT}/.local-cms}"
export ZHAOHUI_LOCAL_DEV_SYNC="1"
export DJANGO_DEBUG="${DJANGO_DEBUG:-1}"
PORT="${ZHAOHUI_DJANGO_PORT:-18000}"

mkdir -p "${ZHAOHUI_RUNTIME_DIR}"

cd "${ADMIN_DIR}"
"${PY_BIN}" manage.py migrate --noinput
"${PY_BIN}" manage.py init_local_cms

echo ""
echo "[local-cms] 启动本地内容管理后台：http://127.0.0.1:${PORT}/publishing/zhaohui/variants/"
exec "${PY_BIN}" manage.py runserver "127.0.0.1:${PORT}"
