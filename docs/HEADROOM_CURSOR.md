# Headroom + Cursor (giảm token khi dev repo này)

[Headroom](https://github.com/chopratejas/headroom) nén output tool / log trước khi vào LLM. **Chỉ dùng trên máy dev** — không ảnh hưởng production `tiennuoc.web.app`.

## Cài một lần (macOS)

```bash
brew install pipx
pipx ensurepath
# Python 3.14 không tương thích — bắt buộc 3.13:
pipx install --python python3.13 "headroom-ai[proxy,mcp]"
```

Kiểm tra: `HEADROOM_PORT=8788 headroom mcp status`

> **Lưu ý:** Port **8787** trên máy bạn thường là **DQA Portal** (Node), không phải Headroom. Repo này dùng **8788** mặc định.

## Dùng hàng ngày

### 1. Bật proxy (terminal riêng, giữ mở)

```bash
cd water-ocr-billing-firebase
npm run headroom:proxy
```

### 2. Cấu hình Cursor (một lần)

**Cursor → Settings → Models:**

| Provider | Override Base URL |
|----------|-------------------|
| OpenAI | `http://127.0.0.1:8788/v1` |
| Anthropic | `http://127.0.0.1:8788` |

API Key: key thật của bạn (OpenAI / Anthropic). Proxy chỉ nén traffic, không thay key.

### 3. Bật MCP Headroom trong project

File `.cursor/mcp.json` đã có server `headroom`. **Reload Cursor** (hoặc tắt/bật MCP) để thấy tools:

- `headroom_compress` — nén nội dung lớn khi cần
- `headroom_retrieve` — lấy lại bản gốc (CCR)
- `headroom_stats` — thống kê tiết kiệm token

### 4. RTK (đã có trong `.cursorrules`)

`headroom wrap cursor` đã inject hướng dẫn `rtk` — agent nên prefix lệnh shell bằng `rtk` khi có thể.

## Xem tiết kiệm token

```bash
headroom perf
curl http://127.0.0.1:8788/stats
```

## Lưu ý

- Không commit API key; proxy chạy local (`127.0.0.1`).
- Nếu Cursor không gọi được MCP: `chmod +x scripts/headroom-mcp.sh` và đảm bảo `headroom` trong `~/.local/bin`.
- Tắt proxy: Ctrl+C terminal `headroom:proxy`, xóa Override Base URL trong Cursor.
