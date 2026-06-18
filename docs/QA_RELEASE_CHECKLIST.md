# QA release — app Android (Closed testing / production)

Dùng bản **release** (AAB hoặc APK từ `flutter build --release`). Ghi **Pass / Fail** trước khi upload Play.

**Go/no-go:** ≥ 10/11 Pass (mục 7 bắt buộc nếu nhân viên dùng máy in BT).

| # | Kịch bản | Vai trò | Pass |
|---|----------|---------|------|
| 1 | Đăng nhập tài khoản nhân viên thật | Collector | |
| 2 | Bảng thu load theo kỳ/tuyến | Collector | |
| 3 | Tìm kiếm không dấu, không thứ tự từ | Collector | |
| 4 | Chốt CSM → tiền đúng công thức | Collector | |
| 5 | Xác nhận thu → khớp web admin | Collector | |
| 6 | Xem / in PDF biên nhận | Collector | |
| 7 | In nhiệt Bluetooth (release build) | Collector | |
| 8 | Admin sửa CSM hộ đã thu → preview tiền đúng | Admin | |
| 9 | Token persist: thoát app → mở lại vẫn đăng nhập | Cả hai | |
| 10 | Mất mạng → thông báo lỗi, không crash | Collector | |
| 11 | Nút ← Trang chủ / menu trên bảng thu (admin) | Admin | |

**Người test:** _______________ **Ngày:** _______________ **Version:** _______________
