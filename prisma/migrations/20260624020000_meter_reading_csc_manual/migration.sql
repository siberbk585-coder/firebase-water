-- Admin điều chỉnh CSC thủ công (thay đồng hồ, sửa sự cố) — không bị auto-sync ghi đè.
ALTER TABLE "meter_reading" ADD COLUMN "csc_manual" BOOLEAN NOT NULL DEFAULT false;
