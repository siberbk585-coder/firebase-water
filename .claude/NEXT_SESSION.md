# Note cho phiên ngày mai

Ngày tạo: 2026-05-25 — kết thúc phiên test/deploy.

## Trạng thái hiện tại

**Đã deploy lên Cloud Run/Firebase App Hosting** với commit `4ee91e8` (build fix BANK_TRANSFER) trên branch `main`.

**Working tree còn 8 file modified + 2 untracked chưa commit** (user sẽ tự commit):

| File | Mục đích | Status |
|---|---|---|
| `lib/pdf.ts` | Thay sharp → @resvg/resvg-js, load TTF từ public/fonts/ | ⚠️ Cần test PDF render trên Cloud Run sau khi commit |
| `next.config.ts` | `outputFileTracingIncludes` cho `/api/invoices/**` + thêm `@resvg/resvg-js` vào `serverExternalPackages` | |
| `package.json` + `package-lock.json` | + `@resvg/resvg-js@2.6.2`, + `@expo-google-fonts/be-vietnam-pro` (có thể uninstall vì không dùng) | |
| `public/fonts/*.ttf` (untracked) | 5 file TTF Be Vietnam Pro (Medium/SemiBold/Bold/ExtraBold/Black) tải từ google/fonts repo | **PHẢI commit, không gitignore** |
| `components/BillingSheetGrid.tsx` | Fix "TRANSFER" → "BANK_TRANSFER" ở payment confirm body (line 219) | |
| `app/admin/dashboard/page.tsx` | "Khu vực thu" lên trên dashboard, grid 2/3/4 cols, progress cap 100% | |
| `lib/routeProgress.ts` | Fix bug 7/5 — query `recorded` thiếu filter `household.status: ACTIVE` và `reading.status IN (PENDING, CONFIRMED)` (exclude REJECTED + INACTIVE) | |
| `lib/seed-data.ts` | Của user, tôi không động | |
| `scripts/update-addresses-haiphong.mjs` (untracked) | Của user | |

**Rác cần dọn trước khi commit** (tôi không có quyền `rm`):
```bash
rm public/fonts/test-*.ttf            # 5 file 14B do download fail
rm -rf public/fonts/public            # nested folder do tôi mkdir lỡ
```

## Việc đang dở

1. **Verify PDF font trên Cloud Run** — đã fix local, nhưng chưa test thực tế sau khi deploy. Sau khi user commit + push + redeploy, cần generate 1 PDF và xem có còn tofu boxes không.

2. **Routes 7/5 bug** — đã fix logic ở `lib/routeProgress.ts`, cần reload dashboard để verify "Bằng Viên" hiển thị 2/5 thay vì 7/5.

3. **A5 test artifact**: 1 payment được mark PAID trên hộ thật (clicked button đầu tiên trong A5 test). Không revert vì có thể là data thật user đang quản lý. Kiểm tra lại nếu cần.

## Điểm cần xem xét sau (chưa blocking)

- **B6 zero usage**: Reading CSM=CSC vẫn confirm được và tạo invoice 0đ — cần business quyết định
- **Badge count UX**: Tab "Chờ chốt (n)" không update real-time client-side sau approve, phải reload
- **Audit còn lại P1/P2 chưa làm**:
  - Component size reduction `BillingSheetGrid.tsx` (486 dòng)
  - Rate limiting login endpoint
  - Session sliding window expiry
  - Cleanup User account khi xóa Household (orphan accounts)

## Test plan đã chạy

Plan file: `/Users/duongdao/.claude/plans/transient-tumbling-orbit.md`

Kết quả: **Phase A 11/11 PASS, Phase B 8 PASS / 3 skip / 0 fail**. Cleanup hoàn tất phase C.

## Deploy info

- `apphosting.yaml` đã có
- DB migration `20260524100000_firebase_auth` đã apply
- Env vars cần set trên Cloud Run: `SESSION_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `BANK_*`, `INVOICE_ISSUER_NAME`, optional `ROBOFLOW_*`

## Quick start mai

1. `git status` để xem 8 file modified còn không
2. Dọn rác `public/fonts/` (2 lệnh rm trên)
3. Commit + push các thay đổi (PDF font, dashboard, routeProgress, BillingSheetGrid payment fix)
4. Redeploy Cloud Run
5. Test PDF tiếng Việt trên production
6. Verify dashboard "Khu vực thu" hiển thị đúng %
