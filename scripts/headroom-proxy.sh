#!/usr/bin/env bash
# Proxy nén context LLM — giữ terminal này mở khi dùng Cursor với Override Base URL
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"
# 8787 thường bị DQA Portal (node) chiếm trên máy dev — dùng 8788
PORT="${HEADROOM_PORT:-8788}"
BASE="http://127.0.0.1:${PORT}"

if curl -sf -m 2 "${BASE}/health" 2>/dev/null | grep -q '"headroom-proxy"'; then
  echo "Headroom proxy đã chạy sẵn tại ${BASE}"
  echo "  OpenAI:    ${BASE}/v1"
  echo "  Anthropic: ${BASE}"
  echo "  Stats:     curl ${BASE}/stats"
  echo ""
  echo "Không cần chạy lại. Muốn restart: kill process trên port ${PORT} rồi chạy lại."
  lsof -i ":${PORT}" 2>/dev/null | head -3 || true
  exit 0
fi

if lsof -i ":${PORT}" >/dev/null 2>&1; then
  echo "Port ${PORT} đang bị chiếm (không phải Headroom). Thử port khác:"
  echo "  HEADROOM_PORT=8789 npm run headroom:proxy"
  lsof -i ":${PORT}" 2>/dev/null | head -5
  exit 1
fi

echo "Headroom proxy → ${BASE}"
echo "  OpenAI base URL:  ${BASE}/v1"
echo "  Anthropic base URL: ${BASE}"
echo "  Stats: curl ${BASE}/stats"
exec headroom proxy --port "${PORT}"
