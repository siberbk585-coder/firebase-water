# Bàn giao phiên làm việc — `tiennuoc` (cập nhật 2026-05-24)

Mở file này lần sau để nhanh chóng tiếp tục.

---

## Production — đang chạy

| Mục | URL / giá trị |
|-----|----------------|
| **Web chính** | https://tiennuoc.web.app/login |
| App Hosting trực tiếp | https://tiennuoc--tiennuoc.asia-southeast1.hosted.app/login |
| Firebase project | `tiennuoc` |
| Cloud SQL | `tiennuoc-db` / DB `tiennuoc_water` |
| Đăng nhập | Tài khoản do quản trị HTX cấp |

Đăng nhập: nhập **SĐT** hoặc `admin` (không gõ `@accounts.tiennuoc.local`).

---

## Đã làm trong phiên này

1. **Migration** `thu-ien-nuoc` → `tiennuoc` (App Hosting, Data Connect, Cloud SQL).
2. **Mock ~50 hộ** + `npm run firebase:provision-auth` (Firebase Auth đồng bộ).
3. **Firebase Hosting** (`tiennuoc.web.app`) rewrite → Cloud Run + IAM `run.invoker`.
4. **Sửa DB production:** `DATABASE_URL` secret, Cloud SQL connector trong `lib/data/prisma.ts` + `instrumentation.ts`, `npm run firebase:wire-cloudsql` sau deploy.
5. **Sửa đăng nhập Hosting:** cookie session đổi tên `water_session` → **`__session`** (Firebase Hosting chỉ forward cookie này).
6. **Gác:** lưu ảnh Drive trực tiếp (vẫn dùng n8n khi cần — xem `docs/n8n/upload-image-mcp.md`).

---

## Mở lại lần sau (checklist nhanh)

### Chỉ dùng web production

1. Mở https://tiennuoc.web.app/login  
2. Đăng nhập bằng tài khoản do quản trị cấp  
3. Nếu 500 / không vào được → xem [Sự cố thường gặp](#sự-cố-thường-gặp)

### Làm việc local (DB + script)

```bash
cd "/Users/duongdao/Dự án nhà máy nước/water-ocr-billing-firebase"
npx -y firebase-tools@latest use tiennuoc

# Terminal 1 — proxy (tắt khi xong: Ctrl+C)
cloud-sql-proxy tiennuoc:asia-southeast1:tiennuoc-db --port 5434

# Terminal 2
unset DATABASE_URL   # tránh trỏ DB cũ trong shell
npm run dev          # hoặc script seed/provision
```

File mật khẩu DB app (không commit): `.tiennuoc-db-pass` (user `tiennuoc_app`).

### Sau khi deploy code mới

```bash
npm run firebase:deploy-apphosting
npm run firebase:post-deploy    # BẮT BUỘC — gắn lại Cloud SQL socket
# tùy chọn:
npm run firebase:deploy-hosting
```

---

## Quản lý tài khoản / mật khẩu

- **Tạo hộ + TK:** Admin → Quản lý hộ → Thêm hộ (SĐT + mật khẩu).
- **Đồng bộ Firebase:** `npm run firebase:provision-auth -- --account SĐT --password 'MK'`
- **Console:** [Firebase Auth Users](https://console.firebase.google.com/project/tiennuoc/authentication/users) — email dạng `0931000001@accounts.tiennuoc.local`
- **DB thô:** `npm run db:studio` (cần proxy + `DATABASE_URL`)

Hai lớp: Postgres `passwordHash` (legacy login) + Firebase Auth. Đổi MK nên cập nhật **cả hai** hoặc chạy provision sau khi sửa DB.

---

## Scripts npm quan trọng

| Lệnh | Việc |
|------|------|
| `firebase:deploy-production` | Deploy app + wire Cloud SQL + hosting |
| `firebase:post-deploy` | Chỉ gắn Cloud SQL (sau deploy apphosting) |
| `firebase:secrets` | Đẩy secrets từ `.env` / `.tiennuoc-db-pass` |
| `firebase:provision-auth` | Postgres → Firebase Auth |
| `firebase:seed-mock-50` | ~50 hộ test |
| `firebase:cloudsql-url` | In connection string |
| `dataconnect:deploy` | Schema GraphQL → SQL |

Chi tiết: [`FIREBASE_TIENNUOC.md`](./FIREBASE_TIENNUOC.md)

---

## Sự cố thường gặp

| Triệu chứng | Xử lý |
|-------------|--------|
| `*.web.app` **403 Forbidden** | `gcloud run services add-iam-policy-binding tiennuoc --region=asia-southeast1 --project=tiennuoc --member=allUsers --role=roles/run.invoker` |
| Đăng nhập OK API nhưng web đá về `/login` | Cookie phải là `__session`; xóa cookie cũ / tab ẩn danh |
| API **500** sau deploy | `npm run firebase:post-deploy` |
| Script DB lỗi bảng sai | `unset DATABASE_URL` trước khi chạy seed/provision |
| **Không ghi đè production** | Xem [DATA_PRODUCTION_POLICY.md](./DATA_PRODUCTION_POLICY.md); `npm run db:audit` |
| Upload ảnh lỗi production | Chưa set `UPLOAD_API_KEY` + `N8N_IMAGE_WEBHOOK_URL` (Drive gác) |

---

## File / secret local (không commit)

- `.tiennuoc-db-pass` — mật khẩu `tiennuoc_app`
- `.env` — copy từ `.env.example`
- `.cloudsql-app-pass` — có thể còn từ project cũ (ưu tiên `.tiennuoc-db-pass`)

---

## Việc chưa làm / backlog

- [ ] `UPLOAD_API_KEY`, webhook N8N, `BANK_*` trên production
- [ ] Lưu ảnh Google Drive (đã gác — qua n8n khi cần)
- [ ] Màn admin **Quản lý tài khoản** (đổi MK đồng bộ Postgres + Firebase)
- [ ] Xóa tài nguyên project cũ `thu-ien-nuoc` khi đã chốt production
- [ ] Cập nhật README (vẫn còn mục Vercel/Neon cũ)

---

## Tài liệu liên quan

- [`FIREBASE_TIENNUOC.md`](./FIREBASE_TIENNUOC.md) — vận hành Firebase
- [`n8n/upload-image-mcp.md`](./n8n/upload-image-mcp.md) — ảnh qua n8n/Drive
- [`n8n/hoadon-invoice.md`](./n8n/hoadon-invoice.md) — PDF hóa đơn
