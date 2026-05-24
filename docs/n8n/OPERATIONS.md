# n8n — Vận hành (ảnh + HĐ PDF + Zalo)

Xem thêm: [upload-image-mcp.md](./upload-image-mcp.md) (ảnh), [hoadon-invoice.md](./hoadon-invoice.md) (PDF hóa đơn).

## 1. Lưu ảnh đồng hồ

**Webhook:** `POST /webhook/luuhinhanh`  
**Env app:** `N8N_IMAGE_WEBHOOK_URL`

Response cần `webContentLink` hoặc `url`.

## 2. Lưu PDF hóa đơn

**Webhook:** `POST /webhook/Hoadon`  
**Env app:** `N8N_INVOICE_WEBHOOK_URL`  
Chi tiết: [hoadon-invoice.md](./hoadon-invoice.md).

`Invoice.pdfPath` = link HTTPS (Drive), không phải file trên server app.

## 3. Gửi hóa đơn Zalo OA + QR

**Webhook (mặc định):** `POST /webhook/send-invoice-zalo`  
**Env app:** `N8N_ZALO_WEBHOOK_URL`  
**Tắt:** `N8N_ZALO_WEBHOOK_DISABLED=true`

### Payload JSON (app gửi)

```json
{
  "source": "firebase-water",
  "invoiceId": "...",
  "householdCode": "HH00001",
  "residentName": "Nguyễn Văn A",
  "contactPhone": "0912345678",
  "periodLabel": "Tháng 5/2026",
  "totalAmount": 150000,
  "usageM3": 10,
  "pdfUrl": "https://drive.google.com/... (link từ webhook Hoadon)",
  "transferNote": "Nuoc Thang 5/2026 HH00001 150000",
  "qrAmount": 150000
}
```

### Workflow gợi ý trên n8n

1. Webhook nhận JSON  
2. Tạo ảnh QR (số tiền + nội dung CK) — VietQR hoặc node QR  
3. Gọi Zalo OA API (template / tin nhắn + ảnh QR + link PDF)  
4. Respond: `{ "ok": true, "messageId": "..." }`

App cập nhật `Invoice.zaloSentAt` sau khi gọi thành công.

## Thứ tự vận hành

1. Hộ gửi ảnh → webhook `luuhinhanh`  
2. Admin chốt CSM → **Tạo hóa đơn kỳ** → PDF lên `Hoadon` → link trong DB  
3. Admin **Gửi Zalo OA + QR** → webhook `send-invoice-zalo` (dùng `pdfUrl` từ DB)
