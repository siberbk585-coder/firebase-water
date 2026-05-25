-- Firebase Auth: liên kết User với Firebase UID; mật khẩu local tùy chọn
ALTER TABLE "User" ADD COLUMN "firebaseUid" TEXT;
CREATE UNIQUE INDEX "User_firebaseUid_key" ON "User"("firebaseUid");
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
