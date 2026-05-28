# Ứng dụng di động (APK) — tách khỏi repo web

Repo này chỉ chứa **web app Next.js** (https://tiennuoc.web.app).

App Android/iOS (Flutter hoặc shell native) nên phát triển trong **repository riêng** để tránh lẫn code khi sửa web.

## Gợi ý tích hợp khi build APK riêng

- **Backend:** cùng API production (`https://tiennuoc.web.app/api/...`).
- **Đăng nhập:** `POST /api/auth/login` hoặc `POST /api/auth/session` (Firebase `idToken`) → dùng `Authorization: Bearer <token>`.
- **Nghiệp vụ hiện trường:** tái sử dụng các endpoint admin có sẵn, ví dụ:
  - `POST /api/admin/readings/upsert` — chốt chỉ số
  - `POST /api/payments/confirm` — xác nhận thu
  - `POST /api/invoices/export-one` — xuất PDF biên nhận
- **Không** phụ thuộc `/api/field/*` (đã gỡ khỏi web repo).

## Web responsive

Giao diện mobile trên trình duyệt (bottom nav, card view) vẫn nằm trong web app — không cần APK để dùng trên điện thoại qua Chrome/Safari.
