# Firebase project `tiennuoc` — hướng dẫn vận hành

> **Mở lại nhanh:** xem [`HANDOFF.md`](./HANDOFF.md) (URL production, tài khoản demo, checklist deploy, sự cố).

## Kiến trúc

| Thành phần | Chi tiết |
|------------|----------|
| Project ID | `tiennuoc` |
| Data Connect | Service `tiennuoc-water`, schema trong `dataconnect/schema/schema.gql` |
| Cloud SQL | Instance `tiennuoc-db`, database `tiennuoc_water` |
| App Hosting | Backend `tiennuoc` → https://tiennuoc--tiennuoc.asia-southeast1.hosted.app |
| Firebase Hosting | CDN + rewrite → Cloud Run `tiennuoc` → https://tiennuoc.web.app |
| Auth | Email/password, domain ảo `accounts.tiennuoc.local`; session cookie **`__session`** (Hosting) |
| App data layer | Prisma (Postgres) + Data Connect SDK (auth/profile) |

## Thiết lập production (lần đầu)

```bash
npx -y firebase-tools@latest use tiennuoc

# 1. User Postgres cho app (tạo .tiennuoc-db-pass)
npm run firebase:create-db-user

# 2. Secrets: DATABASE_URL, SESSION_SECRET, NEXT_PUBLIC_APP_URL, …
npm run firebase:secrets

# 3. Schema DB
npm run dataconnect:deploy
# proxy local: cloud-sql-proxy tiennuoc:asia-southeast1:tiennuoc-db --port 5433
export DATABASE_URL="$(node scripts/firebase-cloudsql-url.mjs | grep '^DATABASE_URL=' | cut -d= -f2-)"
npx prisma migrate deploy

# 4. Dữ liệu + Auth
npm run firebase:seed-mock-50
npm run firebase:provision-auth

# 5. Deploy
npm run firebase:deploy-production
# (= apphosting + wire-cloudsql + hosting)

# Sau mỗi lần deploy apphosting, chạy lại (Cloud SQL socket bị mất):
npm run firebase:post-deploy
```

## Lệnh thường dùng

```bash
npm run dataconnect:deploy
npm run dataconnect:generate
npm run firebase:secrets
npm run firebase:deploy-apphosting
npm run firebase:wire-cloudsql    # sau deploy — gắn Cloud SQL socket
npm run firebase:deploy-hosting
npm run firebase:provision-auth
```

## Firebase Hosting

Rewrite `**` → Cloud Run `tiennuoc`. Cần IAM (một lần):

```bash
gcloud run services add-iam-policy-binding tiennuoc \
  --region=asia-southeast1 --project=tiennuoc \
  --member="allUsers" --role="roles/run.invoker"
```

### Lỗi 403 Forbidden trên `*.web.app`

Xem lệnh IAM ở trên.

## Biến môi trường tùy chọn

Thêm vào `.env` rồi `npm run firebase:secrets` (script tự set secret nếu có giá trị):

- `UPLOAD_API_KEY` — bắt buộc trên production cho `/api/uploads/image`
- `N8N_IMAGE_WEBHOOK_URL`, `N8N_INVOICE_WEBHOOK_URL`, `N8N_ZALO_WEBHOOK_URL`
- `BANK_*`, `BLOB_READ_WRITE_TOKEN`

Sau đó thêm block tương ứng vào `apphosting.yaml` hoặc Firebase Console → App Hosting → Environment.

## Copy ~50 user test từ DB cũ

```bash
export SOURCE_DATABASE_URL="postgresql://..."   # DB cũ
export DATABASE_URL="postgresql://..."          # tiennuoc_water (proxy)
npm run firebase:migrate-subset
npm run firebase:provision-auth
```

## Xóa project cũ `thu-ien-nuoc`

Sau khi xác nhận app mới chạy ổn: xóa backend/Cloud SQL cũ, không deploy lên project đó nữa.
