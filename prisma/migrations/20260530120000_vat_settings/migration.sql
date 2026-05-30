-- Thuế GTGT (VAT): cấu hình hệ thống + chi tiết trên hóa đơn
ALTER TABLE "system_settings"
ADD COLUMN IF NOT EXISTS "vat_percent" DOUBLE PRECISION NOT NULL DEFAULT 10;

ALTER TABLE "invoice"
ADD COLUMN IF NOT EXISTS "subtotal_amount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "vat_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "vat_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Hóa đơn cũ: tiền trước thuế = total_amount hiện tại
UPDATE "invoice"
SET
  "subtotal_amount" = COALESCE("subtotal_amount", "total_amount"),
  "vat_percent" = COALESCE(NULLIF("vat_percent", 0), 0),
  "vat_amount" = COALESCE("vat_amount", 0)
WHERE "subtotal_amount" IS NULL;

ALTER TABLE "invoice"
ALTER COLUMN "subtotal_amount" SET NOT NULL;
