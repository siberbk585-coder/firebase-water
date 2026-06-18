-- Hộ ngưng sử dụng: ghi kỳ cuối cùng còn thu (tháng đóng hộ)

ALTER TABLE "household"
  ADD COLUMN "inactive_from_year" INTEGER,
  ADD COLUMN "inactive_from_month" INTEGER;
