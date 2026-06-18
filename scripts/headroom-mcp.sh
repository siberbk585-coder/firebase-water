#!/usr/bin/env bash
# MCP server Headroom cho Cursor (stdio). Cần proxy: npm run headroom:proxy
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"
export HEADROOM_PROXY_URL="${HEADROOM_PROXY_URL:-http://127.0.0.1:8788}"
exec headroom mcp serve --proxy-url "${HEADROOM_PROXY_URL}" "$@"
