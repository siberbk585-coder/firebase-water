# Backend API — App Android (thu tiền nước tiennuoc)

Tài liệu **chỉ phần backend** để copy sang repo app Android/Flutter. Cập nhật theo web production **dd10484** (2026-05-28).

Brief UI/luồng màn hình: [FLUTTER_ANDROID_AGENT_BRIEF.md](./FLUTTER_ANDROID_AGENT_BRIEF.md).

---

## 1. Kết nối

| Mục | Giá trị |
|-----|---------|
| **Base URL** | `https://tiennuoc.web.app` |
| **Prefix API** | `/api/...` |
| **Content-Type JSON** | `application/json` |
| **Timezone** | `Asia/Ho_Chi_Minh` |
| **Repo web** | `git@github.com:siberbk585-coder/firebase-water.git` |

### Tài khoản test

| Vai trò | `phone` | Mật khẩu |
|---------|---------|----------|
| Admin / nhân viên thu | `admin` | `123456` |
| Hộ dân (không dùng app thu MVP) | `0931000001` … `0931000050` | `123456` |

`phone` gửi API là chuỗi thuần (`admin`, `0931000001`), **không** thêm email.

### Phạm vi app Android MVP

- Chỉ role **`ADMIN`** (nhân viên đi tuyến).
- **Không** dùng `/api/field/*` (đã gỡ).

---

## 2. Xác thực

### 2.1 Đăng nhập

```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "admin",
  "password": "123456"
}
```

**200:**

```json
{
  "ok": true,
  "role": "ADMIN",
  "token": "<signed-session-token>",
  "user": {
    "id": "uuid",
    "name": "string",
    "phone": "admin",
    "role": "ADMIN"
  }
}
```

**401:** `{ "error": "Sai tài khoản hoặc mật khẩu" }`

Nguồn: `app/api/auth/login/route.ts`, `lib/auth.ts` → `createAccessToken()`.

### 2.2 Header mọi request (trừ login)

```http
Authorization: Bearer <token>
```

- Token = HMAC-signed session (cùng định dạng cookie `__session` trên web).
- Hết hạn ~ **7 ngày** (`SESSION_MAX_AGE`).
- Backend cũng chấp nhận Firebase ID token (JWT 3 phần) qua `resolveBearerToken`.

### 2.3 Firebase (tùy chọn)

```http
POST /api/auth/session
Content-Type: application/json

{ "idToken": "<Firebase ID token>" }
```

Response giống login (có `token`, `user`, `role`).

### 2.4 Đăng xuất

```http
POST /api/auth/logout
```

Chủ yếu xóa cookie trên web; app Android chỉ cần **xóa token local**.

### 2.5 Lỗi quyền

| HTTP | Ý nghĩa |
|------|---------|
| `401` | Thiếu/sai token |
| `403` | Không phải ADMIN |
| `400` | Body sai / nghiệp vụ (`error` trong JSON) |
| `404` | Không tìm thấy hộ/kỳ |

---

## 3. Quy tắc nghiệp vụ (backend)

### 3.1 Chốt kỳ liên tiếp (bắt buộc từ 2026-05-28)

Không cho **CONFIRMED** tháng **N** nếu tháng **N−1** (cùng lịch) chưa **CONFIRMED**.

- **Được:** T4 đã chốt, HĐ T4 `ISSUED` chưa thu → vẫn chốt T5.
- **Không:** T4 chưa chốt / PENDING / REJECTED / không có bản ghi → chốt T5 bị từ chối.

**400** ví dụ:

```text
Chưa chốt chỉ số Tháng 4/2026 — cần chốt kỳ trước mới được chốt Tháng 5/2026.
```

Nguồn: `lib/periodChain.ts` → gọi trong `confirmReading()` (`lib/readings.ts`).

### 3.2 Chỉ số cũ (CSC)

Khi nhập/chốt kỳ hiện tại, CSC = `confirmedValue` kỳ **CONFIRMED** gần nhất trước đó (`getOldReading`). Nếu kỳ trước chưa chốt → CSC có thể lấy từ kỳ xa hơn hoặc fallback mã đồng hồ.

### 3.3 Công thức

```text
usageM3    = max(0, CSM - CSC)
gia        = round(usageM3 * unitPrice)              // lib/vat.ts → subtotal
thueGTGT   = round(gia * vatPercent / 100)
thanhTien  = gia + thueGTGT                         // totalAmount, lib/billing.ts preview
```

`unitPrice`: từ nhóm giá hộ hoặc giá tuyến (`lib/routePricing.ts`).

### 3.4 Trạng thái

**Chỉ số (`ReadingStatus`):**

| Giá trị | Ý nghĩa |
|---------|---------|
| `PENDING` | Hộ gửi, chờ duyệt |
| `CONFIRMED` | Đã chốt — tính cước |
| `REJECTED` | Từ chối — hộ gửi lại |

**Hóa đơn (`InvoiceStatus`):**

| Giá trị | Ý nghĩa |
|---------|---------|
| `DRAFT` | Nháp |
| `ISSUED` | Đã phát hành, chưa thu |
| `PAID` | Đã thu |
| `CANCELLED` | Hủy |

**Kỳ (`PeriodStatus`):** `OPEN` | `CLOSED` (đóng kỳ không chặn admin chốt chỉ số trên bảng thu).

**Thanh toán (`method`):** `CASH` | `BANK_TRANSFER`

### 3.5 Sau khi chốt CSM

1. `MeterReading` → `CONFIRMED`, có `usageM3`.
2. `syncInvoiceForConfirmedReading` → tạo/cập nhật `Invoice` `ISSUED` (trừ khi đã `ISSUED`/`PAID` thì giữ nguyên số tiền).
3. Không sửa lại chỉ số nếu HĐ kỳ đó đã **`PAID`**.

---

## 4. Kiểu dữ liệu: hàng bảng thu

Dùng cho danh sách hộ trên tuyến (web: `lib/billingSheet.ts` → `BillingSheetRow`).

```json
{
  "householdId": "uuid",
  "meterCode": "M21201",
  "routeName": "Đường 212",
  "routeSortOrder": 1,
  "residentName": "Nguyễn Văn A",
  "contactPhone": "0931000001",
  "householdCode": "H00001",
  "unitPrice": 15000,
  "oldReading": 145,
  "readingId": "uuid-or-null",
  "csm": 170,
  "status": "CONFIRMED",
  "usageM3": 25,
  "totalAmount": 375000,
  "hasImage": true,
  "imagePath": "readings/...",
  "invoiceId": "uuid-or-null",
  "invoiceStatus": "ISSUED",
  "pdfPath": null,
  "paid": false,
  "paymentMethod": "CASH"
}
```

| Field | Ghi chú |
|-------|---------|
| `oldReading` | CSC hiển thị |
| `csm` | Chỉ số mới (confirmed hoặc OCR/pending) |
| `paid` | `invoiceStatus === PAID` |
| `status` | `null` = chưa có bản ghi kỳ này |

---

## 5. API đã có — dùng trực tiếp

### 5.1 Chốt / cập nhật chỉ số (chính)

```http
POST /api/admin/readings/upsert
Authorization: Bearer <token>
Content-Type: application/json

{
  "householdId": "uuid",
  "periodId": "uuid",
  "confirmedValue": 170
}
```

**200:**

```json
{
  "ok": true,
  "reading": {
    "id": "uuid",
    "confirmedValue": 170,
    "usageM3": 25,
    "status": "CONFIRMED"
  },
  "invoice": {
    "id": "uuid",
    "usageM3": 25,
    "unitPrice": 15000,
    "totalAmount": 375000,
    "status": "ISSUED"
  }
}
```

`invoice` có thể là object đã `ISSUED`/`PAID` (không đổi tiền) hoặc `null` nếu chưa đủ điều kiện.

**400:** `{ "error": "<message tiếng Việt>" }` — gồm lỗi chốt kỳ liên tiếp, CSM < CSC, đã PAID, v.v.

### 5.2 Duyệt chỉ số hộ đã gửi (PENDING)

```http
POST /api/admin/readings/approve
Authorization: Bearer <token>
Content-Type: application/json

{
  "readingId": "uuid",
  "confirmedValue": 170
}
```

`confirmedValue` **optional** — bỏ qua thì dùng giá trị hộ đã gửi.

Response giống upsert (`ok`, `reading`, `invoice`).

### 5.3 Từ chối chỉ số hộ gửi

```http
POST /api/admin/readings/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "readingId": "uuid",
  "reason": "optional"
}
```

**200:** `{ "ok": true, "reading": { ... } }`

### 5.4 Xuất PDF một hộ (tạo HĐ nếu cần)

```http
POST /api/invoices/export-one
Authorization: Bearer <token>
Content-Type: application/json

{
  "householdId": "uuid",
  "periodId": "uuid"
}
```

**200:** body = `application/pdf` (binary)

Headers:

- `Content-Disposition: inline; filename="hoa-don-<meterCode>.pdf"`
- `X-Invoice-Id: <uuid>`
- `Cache-Control: no-store`

**400:** JSON `{ "error": "..." }`

### 5.5 Xuất PDF khi đã có invoiceId

```http
GET /api/invoices/{invoiceId}/export-local
Authorization: Bearer <token>
```

**200:** `application/pdf`

### 5.6 In hàng loạt (tối đa 80 hộ)

```http
POST /api/invoices/export-batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "periodId": "uuid",
  "householdIds": ["uuid", "..."]
}
```

**200:** PDF gộp. Headers: `X-Invoice-Count`, `X-Invoice-Errors` (nếu có lỗi từng hộ).

### 5.7 Xác nhận đã thu

```http
POST /api/payments/confirm
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "uuid",
  "method": "CASH",
  "note": "optional"
}
```

**200:** `{ "ok": true }`

→ `Invoice.status` = `PAID`, tạo/cập nhật `Payment`.

### 5.8 Dashboard (tùy chọn — không có danh sách hộ)

```http
GET /api/dashboard
Authorization: Bearer <token>
```

Chỉ số tổng, không thay cho bảng thu.

### 5.9 Ảnh chỉ số (nếu cần xem)

```http
GET /api/files/{...path}
Authorization: Bearer <token>
```

`imagePath` từ bảng thu (vd. `readings/xxx.jpg`).

### 5.10 Danh sách kỳ + tuyến (bootstrap)

```http
GET /api/mobile/bootstrap
Authorization: Bearer <token>
```

**200:**

```json
{
  "user": { "id": "...", "name": "...", "phone": "...", "role": "ADMIN" },
  "periods": [
    { "id": "uuid", "year": 2026, "month": 5, "status": "OPEN", "label": "Tháng 5/2026" }
  ],
  "defaultPeriodId": "uuid",
  "routes": [
    { "id": "uuid", "code": "T01", "name": "Đường 212", "sortOrder": 0 }
  ]
}
```

Nguồn: `app/api/mobile/bootstrap/route.ts`.

### 5.11 Bảng thu theo kỳ/tuyến

```http
GET /api/mobile/billing-sheet?periodId=<uuid>&routeId=<uuid>&q=<tìm>
Authorization: Bearer <token>
```

| Query | Bắt buộc | Mô tả |
|-------|----------|--------|
| `periodId` | Có | UUID kỳ |
| `routeId` | Không | UUID tuyến; bỏ = tất cả hộ active |
| `q` | Không | Tìm mã hộ, đồng hồ, tên, SĐT |

**200:** mảng `BillingSheetRow[]` (JSON array, không bọc `rows`).

**400:** `{ "error": "Thiếu periodId" }`

Nguồn: `app/api/mobile/billing-sheet/route.ts`.

---

## 6. Luồng gợi ý trên app

```
Login → lưu token (secure storage)
     → GET /api/mobile/bootstrap
     → GET /api/mobile/billing-sheet?periodId=...
     → Chi tiết hộ: CSC readonly, nhập CSM
     → POST readings/upsert
     → POST export-one (PDF) → in/share
     → POST payments/confirm (khi thu tiền)
```

---

## 7. Map file nguồn trên repo web

| Chức năng | File |
|-----------|------|
| Auth / Bearer | `lib/auth.ts` |
| Chốt kỳ liên tiếp | `lib/periodChain.ts` |
| Chốt/duyệt/từ chối | `lib/readings.ts` |
| Bảng thu (server) | `lib/billingSheet.ts` |
| Hóa đơn sync | `lib/invoices.ts` |
| PDF biên nhận | `lib/pdf.ts`, `lib/invoicePdfLocal.ts` |
| Route API | `app/api/mobile/*`, `app/api/admin/readings/*`, `app/api/payments/confirm`, `app/api/invoices/*` |

---

## 8. Ghi chú vận hành

- Deploy web **không** reset database — xem [DATA_PRODUCTION_POLICY.md](./DATA_PRODUCTION_POLICY.md).
- PDF do **server** render (~80mm, in nhiệt); app chỉ tải bytes và in/share.
- Zalo, Excel, đóng kỳ: làm trên **web**, không bắt buộc app MVP.

---

*Tài liệu này có thể copy nguyên file `docs/ANDROID_BACKEND_API.md` sang repo Android.*
