import type { InputMethod, ReadingStatus } from "@/lib/types/enums";
import { parseAnomalyFlags } from "./anomaly";
import { prisma } from "./db";
import { env } from "./env";
import { anomalyLabel, inputMethodLabel, readingStatusLabel } from "./vi";

export async function exportReadingsCsv(periodId?: string): Promise<string> {
  const readings = await prisma.meterReading.findMany({
    where: periodId ? { periodId } : undefined,
    include: {
      household: true,
      period: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  const header = [
    "ma_dong_ho",
    "ho_dan",
    "nam",
    "thang",
    "chi_so_cu",
    "chi_so_xac_nhan",
    "tieu_thu",
    "do_tin_cay",
    "cach_nhap",
    "canh_bao",
    "trang_thai",
  ].join(",");

  const rows = readings.map((r) => {
    const flags = parseAnomalyFlags(r.anomalyFlags).map(anomalyLabel);
    const inputLabel = r.inputMethod
      ? inputMethodLabel(r.inputMethod as InputMethod)
      : "";
    return [
      r.household.meterCode,
      r.household.residentName,
      r.period.year,
      r.period.month,
      r.oldReading,
      r.confirmedValue ?? "",
      r.usageM3 ?? "",
      r.confidence ?? "",
      inputLabel,
      flags.join("; "),
      readingStatusLabel(r.status as ReadingStatus),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  return [header, ...rows].join("\n");
}

/** Stub adapter — enable when GOOGLE_SHEETS_* env vars are set */
export async function pushToGoogleSheet(csvContent: string): Promise<{ ok: boolean; message: string }> {
  if (!env.googleSheetsEnabled()) {
    return {
      ok: false,
      message:
        "Xuất Google Sheets đang tắt. Bật GOOGLE_SHEETS_ENABLED=true và cấu hình thông tin trong .env",
    };
  }
  void csvContent;
  return {
    ok: true,
    message: "Stub: sẽ đẩy lên Google Sheet khi cấu hình service account",
  };
}
