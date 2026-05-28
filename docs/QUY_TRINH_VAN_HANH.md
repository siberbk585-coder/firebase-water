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

## Liên kết nhanh (admin)

- Chờ chốt: `/admin/billing-sheet?status=pending`
- Hóa đơn: `/admin/invoices`
- Xuất Excel: nút trên bảng ghi hoặc `/admin/export`
