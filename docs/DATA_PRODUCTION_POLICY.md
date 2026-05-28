# Chính sách dữ liệu production

Database **tiennuoc_water** (Cloud SQL `tiennuoc-db`) là nguồn dữ liệu vận hành thật. Sau khi đã seed lần đầu, **chỉ người dùng** (qua web admin / API) được thêm, sửa, xóa hộ, chỉ số, hóa đơn.

## Deploy không reset dữ liệu

`npm run firebase:deploy-production` chỉ build Next.js + deploy App Hosting. **Không** chạy `prisma db seed`, `reshape-mock-periods`, hay script mock nào.

## Script bị chặn trên production

Khi `DATABASE_URL` trỏ tới `tiennuoc_water` / Cloud SQL tiennuoc, các lệnh sau **dừng ngay** (trừ khi bạn chủ đích bật override):

| Lệnh | Hành vi |
|------|---------|
| `npm run db:seed` / `db:reset` | Xóa toàn bộ bảng, tạo lại ~250 hộ mock |
| `npm run db:reshape-mock-periods` | Ép lại kịch bản T3/T4/T5 trên toàn DB |
| `npm run firebase:seed-mock-50` | Thêm ~50 hộ mock, ghi đè kỳ |
| `npm run db:update-addresses-haiphong` | Regenerate địa chỉ tất cả hộ |
| `npm run db:seed-test-residents` | Thêm 20 hộ test |
| `npm run firebase:seed-demo` | Upsert admin + kỳ (chỉ dùng lần đầu local) |

Override (hiểu rủi ro xóa/ghi đè):

```bash
ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:seed
```

## Kiểm tra (chỉ đọc)

```bash
npm run db:audit
```

In URL (ẩn mật khẩu), đếm hộ/user/chỉ số/hóa đơn, cảnh báo user mock `0931000*`.

## Thay đổi hợp lệ qua app

- CRUD hộ, chỉ số, xác nhận thanh toán: các trang `/admin/*` và server actions tương ứng.
- Xóa một hộ: `app/admin/households/actions.ts` (theo thao tác admin).

## Dev local

Dùng Postgres local (`DATABASE_URL` không chứa `tiennuoc_water`). Có thể `npm run db:seed` tự do để có dữ liệu demo.

## Lưu ý file upload

Trên Cloud Run, `STORAGE_DIR=tmp` — file PDF/ảnh có thể mất khi instance restart; **bảng Postgres không bị xóa**.
