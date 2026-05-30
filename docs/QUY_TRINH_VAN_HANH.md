# Quy trình vận hành thu tiền nước

## Vai trò

| Vai trò | Việc chính |
|---------|------------|
| **Hộ dân** | Gửi CSM (+ ảnh tùy chọn) trên app |
| **Tổ trưởng / Kế toán** | Chốt chỉ số, tạo HĐ, gửi Zalo, ghi đã thu |
| **n8n (VPS)** | Lưu ảnh + PDF hóa đơn Drive; gửi Zalo OA + QR |

## Checklist theo tháng

### 1. Ghi chỉ số (đầu / giữa tháng)

1. Hộ vào **Ghi chỉ số** → nhập CSM → **Gửi** → trạng thái **Chờ chốt**.
2. Admin mở **Bảng ghi chỉ số** → tab **Chờ chốt** → **Xem ảnh** (nếu có) → **Chốt** hoặc **Từ chối**.
3. Nhân viên có thể nhập trực tiếp trên bảng → **Lưu** (chốt luôn).

### 2. Hóa đơn & Zalo

1. **Hóa đơn** → **Tạo hóa đơn kỳ** (chỉ hộ đã chốt CSM).
2. **Gửi Zalo OA + QR** (n8n) cho HĐ chưa gửi.
3. Hộ xem **Hóa đơn của tôi** trên app.

### 3. Thu tiền

1. Kế toán theo dõi chuyển khoản / tiền mặt.
2. Trên **Bảng ghi chỉ số**: cột **Thu** → **Chưa** → đánh dấu **Đã thu** (hoặc trang **Thanh toán**).
3. Cuối kỳ: **Tải Excel kỳ này** cho sổ kế toán.

### 4. Đóng kỳ

1. **Tổng quan** → cấu hình **Ngày đóng kỳ** (1–28).
2. Sau ngày đóng: hộ **không gửi** chỉ số mới (kỳ OPEN).
3. Khi xong việc: **Đóng kỳ thủ công** → kỳ CLOSED.

## Trạng thái chỉ số

| Trạng thái | Ý nghĩa |
|------------|---------|
| Chờ chốt | Hộ đã gửi, chưa duyệt |
| Đã xác nhận | Đã chốt — dùng tính cước |
| Từ chối | Hộ gửi lại được |

**Chốt kỳ liên tiếp:** Không chốt tháng N nếu tháng N−1 chưa **Đã xác nhận** (ví dụ không chốt T5 khi T4 chưa chốt). Hóa đơn T4 đã phát nhưng **chưa thu** vẫn được chốt T5 bình thường.

## Mẫu biên nhận in (PDF / Bluetooth)

Trường trên bill: tên HTX, **BIÊN NHẬN THANH TOÁN**, `T5(Liên 2)`, Tên KH, Mã KH, Địa chỉ, NĐK/NCK, Hình thức TT, Nội dung, CS cũ/mới, SL truy thu, bảng SL(m³)|Đơn giá|Thành tiền (tiền trước thuế), Thuế GTGT, Tổng tiền, Bằng chữ, Đ/c, LH, Ngày, NV thu.

- Web PDF: `lib/pdf.ts` + `lib/receiptDisplay.ts` (cùng layout app; QR tắt mặc định — `INVOICE_RECEIPT_QR=true` nếu cần).
- App Android: `receipt_builder.dart` (ESC/POS 58mm / 80mm).

## Thuế VAT (GTGT)

- Cấu hình tại **Giá & VAT** (`/admin/area-prices`): % VAT áp dụng toàn hệ thống (mặc định 10%).
- Công thức: **Giá** = m³ × đơn giá khu vực → **Thuế GTGT** = làm tròn(Giá × %) → **Thành tiền** = Giá + Thuế GTGT.
- Hóa đơn lưu `subtotal_amount`, `vat_percent`, `vat_amount`, `total_amount` trên bảng `invoice`.
- Hóa đơn **đã phát hành / đã thu** không tự đổi số khi sửa % VAT.

## Kỳ thu tự động

- Hệ thống **tự tạo kỳ tháng hiện tại** (theo giờ `Asia/Ho_Chi_Minh`) khi mở bảng thu, tổng quan hoặc app mobile.
- Mọi hộ **Đang sử dụng** được gắn bản ghi chỉ số `PENDING` vào **mọi kỳ đang OPEN** (CSC lấy từ kỳ trước đã chốt).
- Hộ mới tạo được gắn vào các kỳ OPEN hiện có; không tự thêm vào kỳ đã **CLOSED**.

## Liên kết nhanh (admin)

- Chờ chốt: `/admin/billing-sheet?status=pending`
- Đã thu: `/admin/billing-sheet?status=paid`
- Hóa đơn: `/admin/invoices`
- Xuất Excel: nút trên bảng ghi hoặc `/admin/export`
