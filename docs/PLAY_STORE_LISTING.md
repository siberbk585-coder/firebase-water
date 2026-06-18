# Play Console — nội dung copy-paste (Closed testing)

App: **Thu tiền nước** · Package: `vn.company.tiennuoc` · Privacy: https://tiennuoc.web.app/privacy

---

## Tạo app

| Mục | Giá trị |
|-----|---------|
| App name | Thu tiền nước |
| Default language | Tiếng Việt |
| App / Game | App |
| Free / Paid | Free |
| Category | Business (hoặc Productivity) |

---

## Store listing

**Short description (80 ký tự):**
```
App thu ghi số nước và xác nhận thanh toán cho nhân viên đi tuyến.
```

**Full description:**
```
Ứng dụng nội bộ cho nhân viên thu tiền nước.

Luồng làm việc:
• Đăng nhập bằng tài khoản do quản trị cấp
• Chọn kỳ thu và tuyến
• Nhập chỉ số mới (CSM), chốt và xác nhận thu tiền
• In biên nhận PDF hoặc máy in nhiệt Bluetooth

Đồng bộ với hệ thống web tiennuoc.web.app.

Yêu cầu: kết nối internet. Bluetooth chỉ dùng để in hóa đơn nhiệt.
```

**Privacy policy URL:** `https://tiennuoc.web.app/privacy`

**Graphics cần chuẩn bị:**
- Icon 512×512 PNG
- Feature graphic 1024×500
- Screenshots: đăng nhập, bảng thu, chi tiết hộ (tối thiểu 2)

---

## Data safety

| Loại dữ liệu | Thu thập | Chia sẻ | Mục đích |
|--------------|----------|---------|----------|
| Tên, SĐT (nhân viên) | Có | Không | Đăng nhập, vận hành |
| Thông tin hộ / hóa đơn | Có | Không | Thu tiền nước |
| Thiết bị (Bluetooth) | Có | Không | In nhiệt |
| Vị trí gần đúng | Có (chỉ Android 6–11 khi quét BT) | Không | Quét Bluetooth theo OS |

- **Encryption in transit:** Có (HTTPS)
- **Users can request deletion:** Có — qua quản trị HTX
- **Data not sold:** Có

---

## App content

- **Target audience:** 18+ / không nhắm trẻ em
- **Ads:** Không
- **Financial features:** Thu hóa đơn nước (không phải ví điện tử)

---

## Bluetooth / quyền đặc biệt

Khai báo trong Permissions declaration:

> Ứng dụng dùng Bluetooth để kết nối máy in nhiệt ESC/POS in biên nhận thu tiền nước. Không dùng Bluetooth để định vị người dùng. Trên Android 12+ dùng quyền BLUETOOTH_SCAN với cờ neverForLocation.

---

## Closed testing upload

1. Play Console → **Testing → Closed testing** → tạo track `alpha-htx`
2. **Create new release** → upload `app-release.aab`
3. Release notes (ví dụ):
   ```
   Bản đầu Closed testing — thu tiền nước, in PDF/BT, đồng bộ tiennuoc.web.app
   ```
4. **Testers** → thêm email Gmail nhân viên HTX
5. **Review and roll out** (review Google lần đầu ~1–7 ngày)

**Play App Signing:** bật khi tạo app — Google giữ upload key; backup file `.jks` local.
