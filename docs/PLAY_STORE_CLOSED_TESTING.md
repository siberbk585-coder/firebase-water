# Play Store Closed testing — hướng dẫn upload

AAB sẵn sàng upload (sau khi chạy `./scripts/build-play-aab.sh`):

```
app android/releases/Thu-tien-nuoc-1.0.1-build3.aab
```

Package: `vn.company.tiennuoc` · Version: **1.0.1 (3)** · Privacy: https://tiennuoc.web.app/privacy

---

## Trước khi upload

1. [ ] Tài khoản [Google Play Developer](https://play.google.com/console) ($25)
2. [ ] QA: điền [`QA_RELEASE_CHECKLIST.md`](./QA_RELEASE_CHECKLIST.md) trên máy thật (release)
3. [ ] Backup keystore: `app android/android/app/tiennuoc-release.jks` + `android/KEYSTORE_SETUP.txt` (không commit)
4. [ ] Chuẩn bị icon 512, feature graphic 1024×500, screenshots

Nội dung listing / Data safety: [`PLAY_STORE_LISTING.md`](./PLAY_STORE_LISTING.md)

---

## Bước upload (Play Console)

1. **Create app** (lần đầu) hoặc mở app **Thu tiền nước**
2. Bật **Play App Signing** khi được hỏi
3. **Testing → Closed testing** → track `alpha-htx` → **Create new release**
4. Upload `Thu-tien-nuoc-1.0.1-build3.aab`
5. Release notes:
   ```
   Closed testing v1.0.1 — thu tiền nước, in PDF/BT, đồng bộ tiennuoc.web.app
   ```
6. **Testers** → thêm email Gmail nhân viên HTX
7. **Review and roll out** → chờ Google review (1–7 ngày lần đầu)

---

## Build bản mới sau này

```bash
cd "app android"
# Lần đầu: ./scripts/setup-play-keystore.sh
# Bump version trong pubspec.yaml (+1 versionCode)
./scripts/build-play-aab.sh
```

Upload AAB mới lên cùng Closed track; tăng `versionCode` mỗi lần.

---

## Phân phối nội bộ (không qua Play)

Firebase App Distribution (đã cấu hình):

```bash
cd water-ocr-billing-firebase
npx firebase appdistribution:distribute \
  "../app android/releases/Thu-tien-nuoc-1.0.1-build2.apk" \
  --app "1:171128777328:android:4a2b64a099f2790bb622b5" \
  --groups "nhóm-app-tiền-nước" \
  --release-notes "..." \
  --project tiennuoc
```

APK: `flutter build apk --release --dart-define=API_BASE_URL=https://tiennuoc.web.app`

---

## Keystore

| File | Mô tả |
|------|--------|
| `android/app/tiennuoc-release.jks` | Keystore release (backup an toàn) |
| `android/key.properties` | Mật khẩu ký (gitignore) |
| `android/KEYSTORE_SETUP.txt` | Ghi chú mật khẩu (gitignore) |

Mất keystore → không cập nhật app trên Play được (trừ khi Play App Signing đã lưu upload key).
