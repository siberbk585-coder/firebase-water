# Brief cho Agent: Xây dựng app Android Flutter — Thu tiền nước (tiennuoc)

Tài liệu này dùng để **giao việc cho một Agent khác** xây dựng app Android (Flutter) **trong repository riêng**, kết nối backend web hiện có. Đọc kỹ trước khi code.

**Contract API backend (file riêng, copy sang repo app):** [ANDROID_BACKEND_API.md](./ANDROID_BACKEND_API.md)

---

## 1. Bối cảnh sản phẩm

### 1.1 Hệ thống hiện tại

| Thành phần | Mô tả |
|------------|--------|
| **Web app** | Next.js 16 + Prisma + PostgreSQL (Cloud SQL), deploy Firebase App Hosting |
| **Production** | https://tiennuoc.web.app |
| **Firebase project** | `tiennuoc` |
| **Repo web** | `git@github.com:siberbk585-coder/firebase-water.git` (thư mục local có thể là `water-ocr-billing-firebase`) |

Web app phục vụ **tổ trưởng / kế toán** (admin) và **hộ dân** (resident). App Flutter mục tiêu **nhân viên đi tuyến thu** trên điện thoại Android: xem danh sách hộ theo kỳ/tuyến, nhập/chốt chỉ số, xác nhận thu tiền, in biên nhận.

### 1.2 Phạm vi repo

- **KHÔNG** đặt code Flutter trong repo web.
- Tạo repo mới, ví dụ: `tiennuoc-field-android` (Flutter).
- Backend **không đổi** trừ khi thiếu API — khi đó mở PR nhỏ vào repo web (xem mục 5).

### 1.3 Đã gỡ khỏi repo web (không dùng lại)

- Thư mục `mobile/` (Capacitor WebView) — legacy.
- Thư mục `mobile-flutter/` — prototype cũ, **đã xóa khỏi disk/repo web**.
- API `/api/field/*` — **đã gỡ**; app Flutter **không** gọi các path này.

Chi tiết tách mobile: [MOBILE_APP.md](./MOBILE_APP.md).

---

## 2. Vai trò người dùng & phạm vi MVP

### 2.1 Vai trò app Flutter (MVP)

Chỉ **ADMIN** (nhân viên thu). **Không** làm app hộ dân trong MVP (hộ dân dùng web/PWA).

| Chức năng | MVP | Ghi chú |
|-----------|-----|---------|
| Đăng nhập | Bắt buộc | Phone + mật khẩu |
| Chọn kỳ thu | Bắt buộc | Tháng/năm OPEN |
| Chọn tuyến thu | Bắt buộc | Hoặc «Tất cả» |
| Danh sách hộ trên tuyến | Bắt buộc | Giống bảng thu web |
| Chi tiết hộ: CSC, CSM, tiền | Bắt buộc | |
| Chốt chỉ số (CSM) | Bắt buộc | Gọi API admin |
| Xác nhận đã thu | Bắt buộc | Tiền mặt / chuyển khoản |
| Xuất & xem PDF biên nhận | Bắt buộc | In nhiệt qua share/print hoặc BT |
| Tìm hộ (mã, tên, đồng hồ) | Nên có | |
| Offline queue | Phase 2 | Không bắt buộc MVP |
| In ESC/POS Bluetooth trực tiếp | Phase 2 | Khuyến nghị sau MVP |
| OCR chụp đồng hồ | Phase 2 | Web đã có OCR server-side |
| Gửi Zalo / Excel | Không | Chỉ trên web |

### 2.2 Luồng nghiệp vụ (theo tháng)

```
1. Mở kỳ OPEN (vd. Tháng 5/2026)
2. Chọn tuyến → danh sách hộ
3. Với từng hộ:
   a. Xem CSC (chỉ số cũ) — từ kỳ trước đã chốt
   b. Nhập CSM (chỉ số mới) → POST chốt → CONFIRMED
   c. Hệ thống tính usageM3, tạo/cập nhật Invoice
   d. In biên nhận PDF (nếu cần)
   e. Khi khách trả tiền → Xác nhận thu → Invoice PAID
4. Cuối kỳ: đóng kỳ trên web (không bắt buộc trên app)
```

Tài liệu vận hành web: [QUY_TRINH_VAN_HANH.md](./QUY_TRINH_VAN_HANH.md).

---

## 3. Môi trường & tài khoản test

| Mục | Giá trị |
|-----|---------|
| Base URL API | `https://tiennuoc.web.app` |
| Admin demo | `admin` / `123456` |
| Hộ mock | `0931000001` … `0931000050` / `123456` |
| Timezone | `Asia/Ho_Chi_Minh` |

**Lưu ý đăng nhập:** Trường `phone` gửi lên API là `admin` hoặc SĐT thuần (vd. `0931000001`), **không** thêm domain email.

---

## 4. Xác thực (bắt buộc implement đúng)

### 4.1 Đăng nhập (khuyến nghị MVP)

```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "admin",
  "password": "123456"
}
```

**Response 200:**

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

**Lỗi:** `401` — `{ "error": "Sai tài khoản hoặc mật khẩu" }`.

Implementation web: `app/api/auth/login/route.ts`, `lib/auth.ts`.

### 4.2 Gọi API sau đăng nhập

Mọi request (trừ login):

```http
Authorization: Bearer <token>
```

Token = chuỗi đã ký (HMAC), **giống** cookie `__session` trên web. Thời hạn ~7 ngày.

### 4.3 Firebase Auth (tùy chọn, phase 1.5)

```http
POST /api/auth/session
Content-Type: application/json

{ "idToken": "<Firebase ID token>" }
```

Backend chấp nhận Bearer là **signed token** hoặc **Firebase JWT 3 phần** (`lib/auth.ts` → `resolveBearerToken`).

### 4.4 Lưu trữ trên thiết bị

- Dùng `flutter_secure_storage` cho `token`, `userId`, `role`.
- Không lưu mật khẩu plaintext.
- Có màn «Đăng xuất» (xóa token local; gọi `POST /api/auth/logout` nếu cần).

### 4.5 Phân quyền

- Nếu `role !== "ADMIN"` sau login → thông báo «Chỉ dành cho nhân viên thu» và thoát.

---

## 5. API backend — hiện có vs cần bổ sung

### 5.1 Vấn đề quan trọng

Web load bảng thu qua **Server Component** (`lib/billingSheet.ts` → `loadBillingSheetRows`), **không** có REST public trả về danh sách hộ theo kỳ/tuyến.

**Agent Flutter MVP cần một trong hai:**

1. **Khuyến nghị:** Yêu cầu team web thêm API (PR nhỏ vào repo web) trước khi làm UI danh sách — contract đề xuất ở **mục 5.2**.
2. **Tạm thời:** Tự implement client giả lập bằng nhiều call (không khả thi) — **không làm**.

### 5.2 API đề xuất team web bổ sung (ưu tiên cao)

Agent Flutter có thể **tự viết spec** và nhờ merge PR web, hoặc implement song song nếu được quyền sửa repo web.

#### `GET /api/mobile/bootstrap`

**Auth:** ADMIN Bearer.

**Response 200:**

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

Nguồn logic: `getBillingPeriods()`, `getCollectionRoutes()` trong `lib/billingSheet.ts`.

#### `GET /api/mobile/billing-sheet?periodId=&routeId=&q=`

**Query:**

| Param | Bắt buộc | Mô tả |
|-------|----------|--------|
| `periodId` | Có | UUID kỳ |
| `routeId` | Không | UUID tuyến; bỏ = tất cả hộ active |
| `q` | Không | Tìm mã hộ, đồng hồ, tên |

**Response 200:** mảng object kiểu `BillingSheetRow` (xem 5.3).

**Auth:** `getSession()` + `requireRole(ADMIN)` — pattern giống các route trong `app/api/admin/*`.

### 5.3 Kiểu dữ liệu hàng bảng thu (tham chiếu web)

Định nghĩa TypeScript web (`lib/billingSheet.ts`):

```typescript
type BillingSheetRow = {
  householdId: string;
  meterCode: string;
  routeName: string | null;
  routeSortOrder: number | null;
  residentName: string;
  contactPhone: string | null;
  householdCode: string;
  unitPrice: number;           // VNĐ/m³
  oldReading: number;          // CSC
  readingId: string | null;
  csm: number | null;          // confirmedValue nếu đã chốt
  status: "PENDING" | "CONFIRMED" | "REJECTED" | null;
  usageM3: number | null;
  totalAmount: number | null;
  hasImage: boolean;
  imagePath: string | null;
  invoiceId: string | null;
  invoiceStatus: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED" | null;
  pdfPath: string | null;
  paid: boolean;
  paymentMethod: "CASH" | "BANK_TRANSFER" | null;
};
```

App Flutter map sang model Dart tương ứng.

### 5.4 API nghiệp vụ đã có sẵn (dùng trực tiếp)

#### Chốt / cập nhật chỉ số

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

**Response 200:**

```json
{
  "ok": true,
  "reading": {
    "id": "uuid",
    "confirmedValue": 170,
    "usageM3": 25,
    "status": "CONFIRMED"
  },
  "invoice": { /* object invoice hoặc null */ }
}
```

**Lỗi thường gặp:** `400` — chưa có CSC, kỳ đóng, giá trị âm, v.v.

**Công thức:**

```text
usageM3 = max(0, confirmedValue - oldReading)
totalAmount = round(usageM3 * unitPrice)
```

(`lib/billing.ts`)

#### Xuất PDF một hộ (tạo HĐ nếu chưa có)

```http
POST /api/invoices/export-one
Authorization: Bearer <token>
Content-Type: application/json

{
  "householdId": "uuid",
  "periodId": "uuid"
}
```

**Response:** `application/pdf` (binary), headers:

- `Content-Disposition: inline; filename="hoa-don-<meterCode>.pdf"`
- `X-Invoice-Id: <uuid>` (nếu vừa tạo)

#### Xuất PDF khi đã có invoiceId

```http
GET /api/invoices/{invoiceId}/export-local
Authorization: Bearer <token>
```

**Response:** `application/pdf`.

#### Xuất PDF gộp nhiều hộ (in hàng loạt)

```http
POST /api/invoices/export-batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "periodId": "uuid",
  "householdIds": ["uuid", "..."]   // tối đa 80
}
```

**Response:** PDF gộp; headers `X-Invoice-Count`, `X-Invoice-Errors`.

#### Xác nhận đã thu

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

`method`: `CASH` | `BANK_TRANSFER`.

**Response:** `{ "ok": true }`.

**Điều kiện:** Invoice tồn tại; thường đã `ISSUED`. Sau confirm → `PAID`.

#### Từ chối / duyệt chỉ số hộ gửi (tùy chọn MVP+)

```http
POST /api/admin/readings/approve
POST /api/admin/readings/reject
```

Body xem `app/api/admin/readings/approve/route.ts`, `reject/route.ts`.

#### Dashboard tổng quan (tùy chọn)

```http
GET /api/dashboard
```

Chỉ trả số liệu tổng, **không** có danh sách hộ.

---

## 6. Màn hình Flutter đề xuất (MVP)

### 6.1 Sơ đồ điều hướng

```
[Splash] → (token?) → [Login]
                         ↓
              [Home: chọn Kỳ + Tuyến]
                         ↓
              [Danh sách hộ] ← tìm kiếm
                         ↓
              [Chi tiết hộ]
                 ├─ Nhập CSM + [Chốt]
                 ├─ [In biên nhận]
                 └─ [Đã thu] (CASH / CK)
```

### 6.2 Chi tiết từng màn

| Màn | Nội dung |
|-----|----------|
| **Login** | Phone, password, nút đăng nhập, hiển thị lỗi API |
| **Home** | Dropdown kỳ (OPEN trước), dropdown tuyến, nút «Vào bảng thu» |
| **Danh sách** | ListView: mã hộ, tên, CSC→CSM, tiền, badge trạng thái (chờ/chốt/đã thu). Màu: chưa chốt / đã chốt chưa thu / đã thu |
| **Chi tiết** | Địa chỉ, SĐT, đơn giá, CSC (readonly), ô CSM, preview tiêu thụ + tiền realtime, nút Chốt, In, Đã thu |
| **PDF** | Mở bằng `printing` / `open_file` / intent share; không bắt buộc WebView |

### 6.3 UX hiện trường

- Font chữ lớn, nút cao ≥ 48dp.
- Hiển thị rõ **mã hộ** và **mã đồng hồ**.
- Sau «Chốt» thành công: snackbar + cập nhật list (không cần reload cả app).
- Mạng chậm: loading indicator, timeout 30s cho PDF.
- Lỗi API: hiển thị `error` từ JSON body.

### 6.4 Ngôn ngữ

- UI tiếng Việt.
- Số tiền format `vi-VN` (vd. `120.000`).

---

## 7. Biên nhận in nhiệt (tham chiếu nội dung)

PDF do **server** sinh (`lib/pdf.ts`), khổ ~80mm, font Roboto Mono. App **không** tự render layout bill trong MVP — chỉ tải PDF và in/share.

### 7.1 Cấu trúc nội dung (mẫu thực tế)

```
[Hợp tác xã thủy sản và dịch vụ môi trường Tiên Lãng]  (căn giữa, env INVOICE_ISSUER_NAME)
BIÊN NHẬN THANH TOÁN
T5(Liên 1)

Tên KH: <IN HOA>
Mã KH: <householdCode>
Địa chỉ: <address>

NĐK: NCK:
Hình thức TT: Tiền mặt | Chuyển khoản
Nội dung: Thanh toán tiền nước
CS cũ: xxx    CS mới: yyy
SL Truy thu: 0

SL(m³)  |  Đơn giá  |  Thành tiền
8       |  15.000   |  120.000
--------------------------------
Thuế GTGT:                    0
Tổng tiền:              120.000
Bằng chữ: một trăm hai mươi nghìn

LH: <số điện thoại>   (nếu env có)
Ngày dd/mm/yyyy HH:mm:ss
NV thu: <tên>         (nếu có)
```

### 7.2 In trên Android (MVP)

1. Tải bytes PDF từ API.
2. Lưu temp file hoặc dùng package `printing` / `open_filex`.
3. **Share** hoặc **Print** qua Android print framework.
4. Phase 2: `print_bluetooth_thermal` + ESC/POS nếu máy in BT (58/80mm).

**Không** mở Chrome ngoài app (web đã tránh `window.open` vì WebView).

---

## 8. Công nghệ Flutter đề xuất

| Hạng mục | Gợi ý |
|----------|--------|
| Flutter SDK | 3.24+ stable |
| State | `riverpod` hoặc `bloc` |
| HTTP | `dio` + interceptor gắn Bearer |
| Auth storage | `flutter_secure_storage` |
| Routing | `go_router` |
| PDF | `printing`, `path_provider` |
| BT in (phase 2) | `print_bluetooth_thermal` |
| Config | `--dart-define=API_BASE_URL=https://tiennuoc.web.app` |

### 8.1 Cấu trúc thư mục gợi ý

```
lib/
  main.dart
  config/env.dart
  core/
    api_client.dart
    auth_storage.dart
    models/
  features/
    auth/
    billing_sheet/
    household_detail/
    pdf_viewer/
```

### 8.2 package name gợi ý

`vn.tiennuoc.field` — app name hiển thị: **Thu ghi số nước**.

---

## 9. Xử lý lỗi & edge case

| Tình huống | Hành vi app |
|------------|-------------|
| 401 / 403 | Xóa token → về Login |
| Hộ chưa chốt mà bấm In | Gọi `export-one` (server tự chốt qua ensure invoice) hoặc báo «Chốt số trước» — **theo web:** phải CONFIRMED trước; `export-one` gọi `ensureInvoiceForHouseholdPeriod` cần reading CONFIRMED |
| `invoiceId` null sau chốt | Dùng `invoice.id` từ response `upsert` hoặc gọi lại list |
| Kỳ CLOSED | Disable chốt; chỉ xem |
| PDF lớn / timeout | Retry; thông báo mạng |
| Không có `invoiceId` khi «Đã thu» | Gọi export-one trước hoặc báo lỗi |

**Quan trọng:** `POST /api/invoices/export-one` yêu cầu reading **CONFIRMED** (`lib/invoicePdfLocal.ts`). Luồng đúng: **Chốt CSM trước → In / Thu**.

---

## 10. Tiêu chí nghiệm thu (Acceptance criteria)

### 10.1 Bắt buộc

- [ ] Cài APK debug, đăng nhập `admin`/`123456` thành công trên mạng thật (production API).
- [ ] Chọn được kỳ OPEN và tuyến; thấy danh sách hộ (sau khi có API mục 5.2).
- [ ] Chốt CSM cho 1 hộ → trạng thái CONFIRMED; tiền hiển thị đúng công thức.
- [ ] In/xem PDF biên nhận 1 hộ; nội dung khớp web (mã hộ, CSC/CSM, tổng tiền).
- [ ] Xác nhận thu → hộ hiển thị đã thu; kiểm tra lại trên web billing-sheet khớp.
- [ ] Token persist: thoát app mở lại vẫn đăng nhập (trong hạn token).
- [ ] Không crash khi mất mạng giữa chừng (hiện lỗi rõ).

### 10.2 Nên có

- [ ] Tìm kiếm theo mã hộ / tên.
- [ ] Pull-to-refresh danh sách.
- [ ] In PDF gộp 2–3 hộ (`export-batch`).

### 10.3 Ngoài phạm vi (không tính done)

- App hộ dân, OCR camera, offline sync, Zalo, Excel, quản lý giá/tuyến.

---

## 11. Quy trình làm việc cho Agent

### Bước 1 — Khảo sát backend

1. Clone repo web, đọc `docs/APP_STRUCTURE.md`, `prisma/schema.prisma`.
2. Xác nhận API mục 5.2 đã merge chưa. **Nếu chưa:** tạo PR web trước (1–2 file route + guard), hoặc block UI list.

### Bước 2 — Scaffold Flutter

1. `flutter create tiennuoc_field --org vn.tiennuoc`.
2. Cấu hình `API_BASE_URL`, dio, secure storage, login flow.

### Bước 3 — MVP theo màn hình mục 6

1. Login → Bootstrap → List → Detail → Upsert → PDF → Payment.

### Bước 4 — Test với production

- Dùng tài khoản demo; kỳ Tháng 5/2026 trên production thường có data mock.
- Đối chiếu với https://tiennuoc.web.app/admin/billing-sheet.

### Bước 5 — Giao hàng

- README repo Flutter: cách build APK, env, tài khoản test.
- Không commit `key.properties` / keystore.

---

## 12. PR vào repo web (nếu Agent được quyền)

Khi thêm `/api/mobile/*`, tuân thủ:

- `getSession()` + role `ADMIN`.
- Reuse `loadBillingSheetRows`, `getBillingPeriods`, `getCollectionRoutes` từ `lib/billingSheet.ts`.
- `export const runtime = "nodejs"`.
- Không đổi schema DB trong PR API mobile.
- Test: `npm run build` pass.

Ví dụ file mới:

- `app/api/mobile/bootstrap/route.ts`
- `app/api/mobile/billing-sheet/route.ts`
- `lib/mobile/requireMobileAdmin.ts` (wrap session ADMIN)

---

## 13. Tài liệu tham chiếu trong repo web

| File | Nội dung |
|------|----------|
| [HANDOFF.md](./HANDOFF.md) | URL production, deploy, sự cố |
| [APP_STRUCTURE.md](./APP_STRUCTURE.md) | Route admin/resident |
| [QUY_TRINH_VAN_HANH.md](./QUY_TRINH_VAN_HANH.md) | Quy trình tháng |
| [MOBILE_APP.md](./MOBILE_APP.md) | Tách repo mobile |
| `lib/billingSheet.ts` | Logic bảng thu |
| `lib/pdf.ts` | Layout biên nhận PDF |
| `lib/pdfBlobUi.ts` | Cách web mở PDF in-app (tham khảo UX) |
| `app/api/auth/login/route.ts` | Login |
| `app/api/admin/readings/upsert/route.ts` | Chốt số |
| `app/api/payments/confirm/route.ts` | Xác nhận thu |
| `app/api/invoices/export-one/route.ts` | PDF 1 hộ |

---

## 14. Ghi chú cho người giao việc (product owner)

- Web **đã** tối ưu in PDF overlay (`pdfBlobUi`) trên trình duyệt; app Flutter nên có trải nghiệm tương đương (xem PDF trong app, nút In/Tải).
- Nếu chỉ cần «có icon app» nhanh: PWA/add-to-homescreen đủ cho nhiều kịch bản; APK Flutter cho **in BT + đi tuyến offline** sau này.
- Mọi thay đổi backend nên **nhỏ, tách PR**, tránh conflict với team web.

---

## 15. Prompt mẫu để paste cho Agent khác

```text
Bạn là senior Flutter engineer. Đọc toàn bộ file docs/FLUTTER_ANDROID_AGENT_BRIEF.md
trong repo web water-ocr-billing-firebase (hoặc bản copy đính kèm).

Nhiệm vụ:
1. Tạo repo Flutter mới (package vn.tiennuoc.field).
2. Nếu chưa có GET /api/mobile/bootstrap và GET /api/mobile/billing-sheet,
   implement PR vào repo web theo contract trong brief, rồi merge/deploy.
3. Build MVP Android: login ADMIN, chọn kỳ/tuyến, danh sách hộ, chốt CSM,
   in PDF biên nhận, xác nhận thu — gọi API production https://tiennuoc.web.app.
4. Test với admin/123456; đối chiếu web billing-sheet.
5. Giao README build APK debug.

Không dùng Capacitor. Không copy code từ thư mục mobile/ đã xóa.
Ưu tiên code sạch, dio + riverpod, tiếng Việt UI.
```

---

*Tài liệu tạo: 2026-05-28 — đồng bộ với web commit có `pdfBlobUi`, không có `/api/field`.*
