# Firebase Water — Thu tiền nước

Dự án độc lập **firebase-water** — ứng dụng vận hành thu tiền nước theo tháng cho tổ dân phố / nhà máy nước quy mô nhỏ. Hộ dân gửi chỉ số đồng hồ (có thể kèm ảnh OCR), tổ trưởng/kế toán chốt CSM, tạo hóa đơn PDF, gửi Zalo OA kèm QR chuyển khoản qua n8n, xác nhận đã thu, xuất Excel khóa sổ.

**Repository:** `git@github.com:siberbk585-coder/firebase-water.git`

---

## Mục lục

1. [Công nghệ](#công-nghệ)
2. [Kiến trúc tổng thể](#kiến-trúc-tổng-thể)
3. [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
4. [Luồng nghiệp vụ](#luồng-nghiệp-vụ)
5. [Cấu trúc thư mục](#cấu-trúc-thư-mục)
6. [API Endpoints](#api-endpoints)
7. [Biến môi trường](#biến-môi-trường)
8. [Cài đặt & chạy local](#cài-đặt--chạy-local)
9. [Tài khoản demo](#tài-khoản-demo)
10. [Scripts](#scripts)
11. [Deploy Firebase (`tiennuoc`)](#deploy-firebase-tiennuoc)
12. [Tích hợp n8n](#tích-hợp-n8n)
13. [OCR & nhận diện đồng hồ](#ocr--nhận-diện-đồng-hồ)

---

## Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind CSS v4 |
| Database | PostgreSQL (Firebase Data Connect + Cloud SQL) — Prisma truy cập cùng schema |
| Auth | Firebase Authentication + session cookie (bcrypt legacy) |
| PDF | pdf-lib (sinh hóa đơn phía server) |
| OCR | Tesseract.js (client/server), Roboflow Workflow (tùy chọn) |
| Ảnh / PDF | Vercel Blob hoặc local `storage/` |
| Automation | n8n (lưu ảnh Drive, gửi Zalo OA, lưu PDF) |
| Excel | xlsx / xlsx-js-style (xuất/nhập sổ thu) |
| QR thanh toán | VietQR (BIN ngân hàng + số tài khoản) |
| Deploy | Firebase App Hosting (`tiennuoc`) |
| MCP | `@modelcontextprotocol/sdk` (upload ảnh từ n8n/agent) |

---

## Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────┐
│                  Next.js App (Vercel)                │
│                                                     │
│  ┌──────────────┐        ┌──────────────────────┐   │
│  │ /resident/*  │        │     /admin/*         │   │
│  │ - submit CSM │        │ - dashboard          │   │
│  │ - xem HĐ    │        │ - billing-sheet      │   │
│  └──────┬───────┘        │ - invoices/payments  │   │
│         │                │ - export/import      │   │
│         └──── API ───────┴──────────┐           │   │
│                                     ▼           │   │
│                          ┌─────────────────┐    │   │
│                          │   Prisma ORM    │    │   │
│                          └────────┬────────┘    │   │
└───────────────────────────────────┼─────────────┘
                                    │
                          ┌─────────▼────────┐
                          │  PostgreSQL/Neon  │
                          └──────────────────┘
                                    
┌──────────────────────────────────────────┐
│              n8n (VPS/Cloud)             │
│  - webhook: lưu ảnh CSM → Google Drive  │
│  - webhook: lưu PDF HĐ → Google Drive   │
│  - webhook: gửi Zalo OA + QR thanh toán │
└──────────────────────────────────────────┘
```

### Xác thực

- Session cookie `water_session` (httpOnly, 7 ngày)
- Payload mã hóa base64url + HMAC-like signature với `SESSION_SECRET`
- Middleware kiểm tra cookie mọi route trừ `/login`, `/api/auth/*`, `/api/uploads/*`, `/api/files/*`
- Phân quyền: `ADMIN` (tổ trưởng/kế toán) và `RESIDENT` (hộ dân)

---

## Cơ sở dữ liệu

Schema Prisma tại [`prisma/schema.prisma`](prisma/schema.prisma), chạy trên PostgreSQL.

### Sơ đồ quan hệ

```
User ──────────────── Household ─────────────── MeterReading
(ADMIN/RESIDENT)       │ │ │                    (CSM theo kỳ)
                       │ │ └─── Invoice ──────── Payment
                       │ │      (HĐ tháng)       (xác nhận thu)
                       │ │
                       │ ├─── PriceGroup (nhóm giá VNĐ/m³)
                       │ └─── CollectionRoute (tuyến thu)
                       │
                       └─── Notification
                       
BillingPeriod ──── MeterReading
(kỳ năm/tháng)    Invoice
                  
SystemSettings (singleton: ngày đóng kỳ, timezone)
AuditLog (lịch sử mọi hành động)
```

### Các model chính

| Model | Mô tả |
|-------|-------|
| `User` | Tài khoản (phone unique, role ADMIN/RESIDENT) |
| `Household` | Hộ dân (householdCode, meterCode, địa chỉ, tuyến, nhóm giá) |
| `CollectionRoute` | Tuyến thu (có thể đặt đơn giá riêng ưu tiên hơn nhóm giá) |
| `PriceGroup` | Nhóm giá VNĐ/m³ |
| `BillingPeriod` | Kỳ thu (year+month, OPEN/CLOSED) |
| `MeterReading` | Chỉ số đồng hồ theo kỳ (OCR + xác nhận + cờ bất thường) |
| `Invoice` | Hóa đơn (DRAFT→ISSUED→PAID/CANCELLED, có PDF path) |
| `Payment` | Xác nhận thanh toán (tiền mặt/chuyển khoản) |
| `AuditLog` | Nhật ký hành động (actor, action, entity, metadata) |
| `SystemSettings` | Cấu hình toàn hệ thống (ngày đóng kỳ mặc định) |

### Enum trạng thái

| Enum | Giá trị |
|------|---------|
| `ReadingStatus` | `PENDING` → `CONFIRMED` / `REJECTED` |
| `InvoiceStatus` | `DRAFT` → `ISSUED` → `PAID` / `CANCELLED` |
| `PeriodStatus` | `OPEN` → `CLOSED` |
| `InputMethod` | `OCR_CONFIRMED`, `OCR_EDITED`, `MANUAL` |

---

## Luồng nghiệp vụ

### Theo tháng

```
[Đầu tháng]
  Hộ dân → submit CSM (+ ảnh) → PENDING
  Admin → xem bảng → Chốt (CONFIRMED) hoặc Từ chối (REJECTED)
  Admin → nhập trực tiếp → CONFIRMED ngay

[Giữa tháng]
  Admin → Tạo hóa đơn kỳ → Invoice DRAFT
  Admin → Phát hành hóa đơn → Invoice ISSUED
  Admin → Gửi Zalo OA + QR → n8n webhook → Zalo OA

[Cuối tháng]
  Kế toán → xác nhận thu tiền → Invoice PAID
  Admin → Tải Excel kỳ này → khóa sổ
  Admin → Đóng kỳ thủ công → BillingPeriod CLOSED
```

### Trang theo vai trò

**Hộ dân** (`/resident/*`):
- `/resident/submit-reading` — gửi CSM và ảnh đồng hồ
- `/resident/invoices` — xem hóa đơn, trạng thái thanh toán

**Admin** (`/admin/*`):
- `/admin/dashboard` — tổng quan kỳ, tiến độ, cảnh báo bất thường
- `/admin/billing-sheet` — bảng thu theo kỳ/tuyến, chốt CSM, đánh dấu đã thu nhanh
- `/admin/invoices` — tạo/phát hành hóa đơn, xuất PDF, gửi Zalo
- `/admin/payments` — xác nhận thanh toán chi tiết
- `/admin/households` — quản lý danh sách hộ dân
- `/admin/routes` — quản lý tuyến thu
- `/admin/area-prices` — quản lý nhóm giá
- `/admin/export` — xuất/nhập Excel sổ thu
- `/admin/audit-log` — nhật ký hoạt động hệ thống
- `/admin/operations` — quy trình vận hành

---

## Cấu trúc thư mục

```
firebase-water/
├── app/
│   ├── admin/              # Màn hình quản trị
│   │   ├── dashboard/      # Tổng quan kỳ thu
│   │   ├── billing-sheet/  # Bảng ghi chỉ số
│   │   ├── invoices/       # Quản lý hóa đơn
│   │   ├── payments/       # Xác nhận thu tiền
│   │   ├── households/     # Quản lý hộ dân
│   │   ├── routes/         # Tuyến thu
│   │   ├── area-prices/    # Nhóm giá
│   │   ├── export/         # Xuất Excel
│   │   ├── audit-log/      # Nhật ký
│   │   └── operations/     # Quy trình vận hành
│   ├── resident/           # Màn hình hộ dân
│   │   ├── submit-reading/ # Gửi chỉ số
│   │   └── invoices/       # Xem hóa đơn
│   ├── api/                # API Routes
│   │   ├── admin/          # Admin-only: readings, settings, periods
│   │   ├── auth/           # login / logout
│   │   ├── dashboard/      # Dữ liệu tổng quan
│   │   ├── exports/        # xlsx, period-xlsx, sheets
│   │   ├── files/          # Phục vụ file local
│   │   ├── imports/        # Import Excel
│   │   ├── invoices/       # Tạo HĐ, PDF, Zalo
│   │   ├── payments/       # Xác nhận thanh toán
│   │   ├── readings/       # Submit, OCR, confirm
│   │   └── uploads/        # Upload ảnh (MCP/n8n)
│   ├── invoice/[id]/       # Trang HĐ public (link Zalo)
│   └── login/              # Trang đăng nhập
│
├── components/             # React components dùng lại
│   ├── BillingSheetGrid    # Bảng thu chính
│   ├── BillingSheetSummary # Tổng kết bảng thu
│   ├── AppShell / AppNav   # Layout & navigation
│   ├── AddHouseholdModal   # Thêm hộ dân
│   └── ...
│
├── lib/                    # Business logic & utilities
│   ├── billing.ts          # Tính tiêu thụ, tiền nước
│   ├── billingSheet.ts     # Dữ liệu bảng thu
│   ├── readings.ts         # Nghiệp vụ chỉ số (ghi/duyệt/từ chối)
│   ├── invoices.ts         # Tạo, phát hành, hủy hóa đơn
│   ├── invoicePdf.ts       # PDF hóa đơn (n8n)
│   ├── invoicePdfLocal.ts  # PDF hóa đơn (local, pdf-lib)
│   ├── pdf.ts              # Tiện ích PDF
│   ├── auth.ts             # Session, login, phân quyền
│   ├── db.ts               # Prisma client singleton
│   ├── env.ts              # Đọc biến môi trường
│   ├── storage.ts          # Đường dẫn lưu file
│   ├── imageUpload.ts      # Upload ảnh (Blob / n8n)
│   ├── n8nWebhook.ts       # Gọi webhook n8n
│   ├── n8nInvoice.ts       # Gửi PDF HĐ qua n8n
│   ├── n8nInvoicePdf.ts    # Build payload PDF n8n
│   ├── n8nLink.ts          # Link Zalo / n8n
│   ├── anomaly.ts          # Phát hiện tiêu thụ bất thường
│   ├── audit.ts            # Ghi nhật ký hành động
│   ├── paymentQr.ts        # Tạo QR VietQR
│   ├── xlsxExport.ts       # Xuất Excel
│   ├── xlsxImport.ts       # Nhập Excel
│   ├── sheetsExport.ts     # Google Sheets (tùy chọn)
│   ├── routePricing.ts     # Lấy đơn giá theo tuyến/nhóm
│   ├── routeProgress.ts    # Tiến độ tuyến thu
│   ├── household.ts        # CRUD hộ dân
│   ├── householdPeriod.ts  # Thông tin hộ theo kỳ
│   ├── ocr.ts              # Tesseract OCR
│   ├── meterDetect.ts      # Roboflow detect đồng hồ
│   ├── guards.ts           # Auth guards cho API
│   └── vi.ts               # Tiện ích format tiếng Việt
│
├── prisma/
│   ├── schema.prisma       # Schema database
│   ├── seed.ts             # Seed 250 hộ + 3 tháng lịch sử
│   └── migrations/         # Lịch sử migration
│
├── docs/
│   ├── APP_STRUCTURE.md    # Luồng điều hành chi tiết
│   ├── QUY_TRINH_VAN_HANH.md # Checklist vận hành hàng tháng
│   ├── OCR_MODEL_COLAB.md  # Hướng dẫn train model OCR
│   └── n8n/                # Workflow n8n + hướng dẫn tích hợp
│
├── storage/                # File local (ảnh CSM, PDF HĐ)
│   ├── readings/           # Ảnh đồng hồ
│   ├── invoices/           # PDF hóa đơn
│   └── uploads/            # Upload tạm thời
│
├── scripts/
│   ├── ensure-postgres-env.mjs   # Kiểm tra env PostgreSQL
│   ├── prepare-db-env.mjs        # Chuẩn bị env cho build
│   ├── mcp-image-upload.mjs      # MCP server upload ảnh
│   ├── test-hoadon-webhook.mjs   # Test webhook hóa đơn
│   └── seed-test-residents.ts    # Seed hộ dân test
│
├── __tests__/              # Unit tests
│   ├── anomaly.test.ts     # Test phát hiện bất thường
│   ├── billing.test.ts     # Test tính tiền nước
│   └── pdf.test.ts         # Test sinh PDF
│
├── middleware.ts           # Auth middleware (cookie check)
├── next.config.ts
└── package.json
```

---

## API Endpoints

### Auth
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/auth/login` | Đăng nhập, set session cookie |
| POST | `/api/auth/logout` | Đăng xuất, xóa cookie |

### Chỉ số đồng hồ
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/readings/submit` | Hộ dân gửi CSM + ảnh |
| POST | `/api/readings/ocr` | OCR ảnh đồng hồ |
| POST | `/api/readings/confirm` | Resident xác nhận lại |
| POST | `/api/admin/readings/approve` | Admin chốt chỉ số |
| POST | `/api/admin/readings/reject` | Admin từ chối chỉ số |
| POST | `/api/admin/readings/upsert` | Admin nhập/sửa trực tiếp |

### Hóa đơn
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/invoices/generate` | Tạo hóa đơn kỳ (tất cả hộ đã chốt) |
| GET/POST | `/api/invoices/[id]/pdf` | Xuất PDF hóa đơn |
| POST | `/api/invoices/[id]/export-local` | Lưu PDF local |
| POST | `/api/invoices/export-one` | Xuất 1 HĐ qua n8n |
| POST | `/api/invoices/send-zalo` | Gửi Zalo OA + QR qua n8n |

### Thanh toán
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/payments/confirm` | Xác nhận đã thu tiền |

### Export / Import
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/exports/xlsx` | Xuất Excel toàn bộ |
| GET | `/api/exports/period-xlsx` | Xuất Excel theo kỳ |
| GET | `/api/exports/sheets` | Đẩy lên Google Sheets |
| POST | `/api/imports/period-xlsx` | Nhập Excel kỳ thu |

### Admin
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/dashboard` | Dữ liệu tổng quan |
| POST | `/api/admin/periods/close` | Đóng kỳ thu |
| GET/POST | `/api/admin/settings` | Cài đặt hệ thống |

### File & Upload
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/files/[...path]` | Phục vụ file local |
| POST | `/api/uploads/image` | Upload ảnh (MCP/n8n, cần `UPLOAD_API_KEY`) |

---

## Biến môi trường

Sao chép `.env.example` → `.env` và điền các giá trị:

### Bắt buộc
| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | PostgreSQL direct URL (cho migrate) |
| `SESSION_SECRET` | Chuỗi bí mật ký cookie session |

### Tuỳ chọn — nghiệp vụ
| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `DEFAULT_UNIT_PRICE` | `15000` | Đơn giá VNĐ/m³ mặc định |
| `OCR_CONFIDENCE_THRESHOLD` | `70` | Ngưỡng tin cậy OCR (%) |
| `STORAGE_DIR` | `storage` | Thư mục lưu file local |
| `NEXT_PUBLIC_APP_URL` | — | URL app (cho link trong HĐ) |

### Tích hợp n8n
| Biến | Mô tả |
|------|-------|
| `N8N_IMAGE_WEBHOOK_URL` | Webhook lưu ảnh CSM vào Drive |
| `N8N_INVOICE_WEBHOOK_URL` | Webhook lưu PDF HĐ vào Drive |
| `N8N_ZALO_WEBHOOK_URL` | Webhook gửi Zalo OA + QR |

### Upload & Blob
| Biến | Mô tả |
|------|-------|
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (URL bền cho ảnh) |
| `UPLOAD_API_KEY` | API key bảo vệ endpoint upload ảnh |

### QR thanh toán VietQR
| Biến | Mô tả |
|------|-------|
| `BANK_BIN` | BIN ngân hàng (VD: `970436` = Vietcombank) |
| `BANK_ACCOUNT` | Số tài khoản |
| `BANK_ACCOUNT_NAME` | Tên tài khoản |
| `BANK_QR_TEMPLATE` | Template QR (`compact2`, `print`, ...) |

### OCR nâng cao (Roboflow)
| Biến | Mô tả |
|------|-------|
| `METER_DETECT_ENABLED` | `true` để bật Roboflow detect |
| `ROBOFLOW_API_KEY` | API key Roboflow |
| `ROBOFLOW_WORKSPACE` | Workspace ID |
| `ROBOFLOW_WORKFLOW_ID` | Workflow ID (hoặc dùng `ROBOFLOW_WORKFLOW_URL`) |

---

## Cài đặt & chạy local

### Yêu cầu
- Node.js 20+
- PostgreSQL (hoặc Neon free branch)

### Các bước

```bash
# 1. Clone và cài dependencies
git clone git@github.com:siberbk585-coder/firebase-water.git
cd firebase-water
npm install

# 2. Cấu hình môi trường
cp .env.example .env
# Sửa DATABASE_URL, DATABASE_URL_UNPOOLED, SESSION_SECRET

# 3. Chạy migration và seed dữ liệu
npm run db:migrate        # hoặc db:migrate:deploy
npm run db:seed           # seed 250 hộ + 3 tháng lịch sử

# 4. Khởi động dev server
npm run dev               # port 3000
npm run dev -- -p 3001    # nếu port 3000 bị chiếm
```

Mở [http://localhost:3001](http://localhost:3001)

**Lệnh nhanh (tất cả trong 1):**
```bash
cp .env.example .env && npm install && npm run db:migrate && npm run db:seed && npm run dev -- -p 3001
```

---

## Tài khoản demo

Sau khi chạy `npm run db:seed`:

| Vai trò | Tài khoản | Mật khẩu |
|---------|-----------|----------|
| Admin (tổ trưởng) | `admin` | `123456` |
| Hộ dân | `0912345678` | `123456` |

Hộ dân demo gắn với đồng hồ `DH00001`.

---

## Scripts

| Lệnh | Mô tả |
|------|-------|
| `npm run dev` | Dev server (port 3000) |
| `npm run dev -- -p 3001` | Dev server port 3001 |
| `npm run build` | Build production (prisma generate + migrate deploy + next build) |
| `npm run db:migrate` | Tạo và áp migration mới (dev) |
| `npm run db:migrate:deploy` | Áp migration lên production |
| `npm run db:seed` | Seed 250 hộ + 3 tháng lịch sử |
| `npm run db:studio` | Mở Prisma Studio |
| `npm run db:seed-test-residents` | Seed thêm hộ dân test |
| `npm test` | Unit tests (anomaly, billing, pdf) |
| `npm run mcp:upload` | MCP server upload ảnh |
| `npm run test:hoadon` | Test webhook hóa đơn n8n |

---

## Xác thực (Firebase Auth + phân quyền)

| Vai trò | Tài khoản demo | Quyền |
|---------|----------------|-------|
| **ADMIN** | `admin` / `123456` | Toàn bộ `/admin/*` |
| **RESIDENT** | `0912345678` / `123456` | `/resident/*` |

- Đăng nhập qua **Firebase Authentication** (email/password). Số điện thoại được map thành `sdt@accounts.thu-ien-nuoc.local`.
- **Phân quyền** lưu trong Postgres (`User.role`) và đồng bộ **custom claim** Firebase (`ADMIN` / `RESIDENT`).
- Admin chỉ truy cập khu vực quản trị; hộ dân chỉ xem khu vực hộ dân (`lib/guards.ts`).

```bash
# Bật Email/Password (đã deploy): firebase deploy --only auth

# Đồng bộ user DB → Firebase (sau migrate)
npm run firebase:provision-auth -- --account admin --password 123456
npm run firebase:provision-auth              # tất cả user
npm run firebase:provision-auth -- --role ADMIN
```

Biến môi trường: xem `.env.example` (`NEXT_PUBLIC_FIREBASE_*`).

---

## Deploy Firebase (`tiennuoc`)

**Production:** https://tiennuoc--tiennuoc.asia-southeast1.hosted.app

Chi tiết: [docs/FIREBASE_TIENNUOC.md](docs/FIREBASE_TIENNUOC.md)

| Thành phần | Giá trị |
|------------|---------|
| Firebase project | `tiennuoc` |
| Data Connect | `tiennuoc-water` |
| Cloud SQL | `tiennuoc-db` / DB `tiennuoc_water` |
| App Hosting backend | `tiennuoc` |

```bash
npx -y firebase-tools@latest use tiennuoc
npm run dataconnect:deploy          # schema GraphQL → Postgres
npx -y firebase-tools@latest dataconnect:sql:migrate --force
npm run firebase:secrets
npx -y firebase-tools@latest deploy --only apphosting
# Seed ~50 user test (tùy chọn):
# SOURCE_DATABASE_URL=... DATABASE_URL=... npm run firebase:migrate-subset
npm run firebase:provision-auth
```

Bật **Email/Password** tại [Authentication](https://console.firebase.google.com/project/tiennuoc/authentication/providers).

---

## Deploy (Vercel + Neon) — dự án cũ (không dùng)

1. Push repo [firebase-water](https://github.com/siberbk585-coder/firebase-water) lên GitHub.
2. Vercel → **Import project** → **Storage → Neon** (chọn **Free**).
3. Thêm biến môi trường Production:
   - `DATABASE_URL` — từ Neon (pooled)
   - `DATABASE_URL_UNPOOLED` — từ Neon (direct, cho migrate)
   - `SESSION_SECRET` — chuỗi ngẫu nhiên dài (≥32 ký tự)
   - `NEXT_PUBLIC_APP_URL` — URL Vercel của bạn
   - Các biến n8n, QR, Blob nếu cần
4. Build command tự động: `npm run build` (bao gồm `prisma migrate deploy`).
5. Seed production một lần: chạy `npm run db:seed` với env production.

> **Lưu ý:** File ảnh/PDF lưu trong `storage/` sẽ mất sau mỗi lần redeploy trên Vercel. Kích hoạt **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`) để có URL bền.

---

## Tích hợp n8n

Xem chi tiết tại [`docs/n8n/`](docs/n8n/).

Có 3 webhook chính:

| Webhook | Biến môi trường | Chức năng |
|---------|----------------|-----------|
| Lưu ảnh CSM | `N8N_IMAGE_WEBHOOK_URL` | Nhận ảnh base64 → lưu Google Drive → trả URL |
| Lưu PDF HĐ | `N8N_INVOICE_WEBHOOK_URL` | Nhận PDF base64 + metadata → lưu Drive |
| Gửi Zalo OA | `N8N_ZALO_WEBHOOK_URL` | Nhận thông tin HĐ + QR → gửi tin nhắn Zalo OA |

Workflow n8n mẫu: [`docs/n8n/workflow-*.json`](docs/n8n/)

Để tắt từng webhook (dùng lưu local thay thế): set biến `N8N_IMAGE_WEBHOOK_DISABLED=true`, `N8N_INVOICE_WEBHOOK_DISABLED=true`, hoặc `N8N_ZALO_WEBHOOK_DISABLED=true`.

---

## OCR & nhận diện đồng hồ

### Tesseract.js (mặc định)
- Chạy trực tiếp trên server, không cần cấu hình thêm.
- Ngưỡng tin cậy: `OCR_CONFIDENCE_THRESHOLD` (mặc định 70%).

### Roboflow Workflow (nâng cao, tùy chọn)
- Phát hiện vùng số đồng hồ trước khi OCR → tăng độ chính xác.
- Bật bằng `METER_DETECT_ENABLED=true` + cấu hình `ROBOFLOW_*`.
- Hướng dẫn train model: [`docs/OCR_MODEL_COLAB.md`](docs/OCR_MODEL_COLAB.md).

---

## Tài liệu thêm

- [Luồng điều hành chi tiết](docs/APP_STRUCTURE.md)
- [Checklist vận hành hàng tháng](docs/QUY_TRINH_VAN_HANH.md)
- [Hướng dẫn tích hợp n8n](docs/n8n/OPERATIONS.md)
- [Hướng dẫn train model OCR](docs/OCR_MODEL_COLAB.md)
