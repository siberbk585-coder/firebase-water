# n8n Webhook — Lưu PDF hóa đơn (`Hoadon`)

App tạo PDF (có QR VietQR) rồi **POST multipart** lên n8n; workflow lưu (Drive, …) và **trả link**. DB chỉ lưu URL trong `Invoice.pdfPath` — không lưu file trên Vercel.

**Webhook:** cấu hình qua `N8N_INVOICE_WEBHOOK_URL` (vd `https://your-n8n.example/webhook/Hoadon`)

## Env app

| Biến | Mô tả |
|------|--------|
| `N8N_INVOICE_WEBHOOK_URL` | URL webhook n8n lưu PDF (bắt buộc nếu dùng luồng Drive) |
| `N8N_INVOICE_WEBHOOK_DISABLED` | `true` → fallback lưu `storage/invoices/` (chỉ dev) |

## Payload gửi tới n8n

`multipart/form-data`:

| Field | Mô tả |
|-------|--------|
| `pdf` / `file` | File PDF |
| `filename` | Tên file gợi ý |
| `invoiceId` | UUID hóa đơn |
| `householdId`, `periodId` | |
| `householdCode`, `meterCode` | |
| `periodLabel` | VD `Tháng 5/2026` |
| `totalAmount` | Số tiền |
| `source` | `firebase-water` |

## Response bắt buộc

JSON có ít nhất một trong: `url`, `webContentLink`, `pdfUrl`, `downloadUrl`, …

```json
{
  "ok": true,
  "url": "https://drive.google.com/uc?export=download&id=..."
}
```

Không có link → app báo *"n8n webhook Hoadon không trả link PDF"*.

## Workflow gợi ý (n8n)

1. **Webhook** POST, path `Hoadon`, nhận binary `pdf` hoặc `file`
2. **Google Drive** (hoặc S3) upload
3. **Respond to Webhook** trả `webContentLink` / `url`

Có thể copy cấu trúc workflow `luuhinhanh`, đổi binary field sang PDF.

## Thứ tự vận hành

1. Admin chốt CSM  
2. **Tạo hóa đơn kỳ** → app → `Hoadon` → link vào DB  
3. **Gửi Zalo** → `send-invoice-zalo` dùng `pdfUrl` = link Drive (không qua app)

## Test nhanh (đã xác nhận 200 + Drive)

```bash
node scripts/test-hoadon-webhook.mjs
# hoặc PDF có sẵn:
node scripts/test-hoadon-webhook.mjs ./storage/invoices/xxx.pdf
```

Response mẫu từ n8n (mảng — app đọc được):

```json
[{"webContentLink":"https://drive.google.com/uc?id=...&export=download"}]
```

**Lưu ý:** Gửi file rỗng (`/dev/null`) → n8n trả `500 Workflow execution failed`.

## Test curl

```bash
curl -X POST "$N8N_INVOICE_WEBHOOK_URL" \
  -F "pdf=@/tmp/test-invoice.pdf;type=application/pdf" \
  -F "householdCode=HH00001" \
  -F "invoiceId=test-id" \
  -F "source=firebase-water"
```

## Lỗi thường gặp

| Triệu chứng | Xử lý |
|-------------|--------|
| HTTP 404 | Workflow **Active**, path `Hoadon`, method POST |
| Không trả link | Node Respond phải trả `url` hoặc `webContentLink` |
| Timeout | Tạo từng batch nhỏ; timeout app 120s/file |

Hóa đơn cũ lưu local (`invoices/xxx.pdf`) vẫn xem qua `/api/invoices/[id]/pdf`.
