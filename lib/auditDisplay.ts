import { calculateUsage, formatCurrency } from "./billing";
import { auditSourceLabel } from "./auditClient";
import {
  formatPeriod,
  inputMethodLabel,
  invoiceStatusLabel,
  paymentMethodLabel,
} from "./vi";

export type AuditDetailLine = { label: string; value: string };

/** Nhãn tiếng Việt cho khóa metadata nhật ký. */
const META_LABELS: Record<string, string> = {
  maHo: "Mã hộ",
  mkh: "Đồng hồ",
  tenHo: "Tên hộ",
  ky: "Kỳ",
  csc: "CSC",
  csm: "CSM",
  tieuThu: "Tiêu thụ",
  coAnh: "Ảnh",
  lyDo: "Lý do",
  ghiChu: "Ghi chú",
  periodId: "Mã kỳ",
  amount: "Số tiền",
  soTien: "Số tiền",
  count: "Số lượng",
  created: "Tạo mới",
  failed: "Lỗi",
  sent: "Đã gửi",
  skipped: "Bỏ qua",
  errorCount: "Lỗi gửi",
  readingUpdated: "Cập nhật chỉ số",
  paymentUpdated: "Cập nhật thu tiền",
  errors: "Dòng lỗi",
  durationMs: "Thời gian xử lý",
  filename: "Tệp",
  householdCode: "Mã hộ",
  meterCode: "Đồng hồ",
  paymentMethod: "Hình thức thu",
  hinhThuc: "Hình thức thu",
  phuongThuc: "Cách nhập",
  trangThaiHd: "Trạng thái HĐ",
  donGia: "Đơn giá",
  staleActorId: "Actor cũ",
  nguon: "Nguồn",
};

const MONEY_KEYS = new Set(["amount", "soTien", "donGia"]);
const M3_SUFFIX_KEYS = new Set(["tieuThu"]);
const MS_KEYS = new Set(["durationMs"]);

function formatMetaValue(key: string, v: unknown): string {
  if (v == null || v === "") return "";
  if (key === "coAnh" && typeof v === "boolean") return v ? "Có" : "Không";
  if (key === "skipped" && typeof v === "boolean") return v ? "Có" : "Không";
  if (MONEY_KEYS.has(key) && typeof v === "number") return formatCurrency(v);
  if (MS_KEYS.has(key) && typeof v === "number") {
    return v >= 1000 ? `${(v / 1000).toFixed(1)} giây` : `${v} ms`;
  }
  if (
    (key === "hinhThuc" || key === "paymentMethod") &&
    typeof v === "string"
  ) {
    return paymentMethodLabel(v);
  }
  if (key === "phuongThuc" && typeof v === "string") {
    return inputMethodLabel(v);
  }
  if (key === "trangThaiHd" && typeof v === "string") {
    return invoiceStatusLabel(v);
  }
  if (key === "nguon") {
    return auditSourceLabel(v);
  }
  if (
    typeof v === "number" &&
    (key === "csc" || key === "csm" || key === "tieuThu")
  ) {
    const n = Number.isInteger(v) ? String(v) : v.toFixed(1);
    return M3_SUFFIX_KEYS.has(key) ? `${n} m³` : n;
  }
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

export function isEmptyAuditMetadata(raw: string | null | undefined): boolean {
  if (!raw || raw === "{}") return true;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return !Object.entries(obj).some(([, v]) => v != null && v !== "");
  } catch {
    return false;
  }
}

export function parseAuditMetadata(
  raw: string | null | undefined
): Record<string, unknown> {
  if (!raw || raw === "{}") return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw: raw.slice(0, 200) };
  }
}

export function metadataToDetailLines(
  meta: Record<string, unknown>
): AuditDetailLine[] {
  const order = [
    "ky",
    "tenHo",
    "maHo",
    "mkh",
    "householdCode",
    "meterCode",
    "csc",
    "csm",
    "tieuThu",
    "soTien",
    "amount",
    "donGia",
    "hinhThuc",
    "paymentMethod",
    "phuongThuc",
    "trangThaiHd",
    "coAnh",
    "lyDo",
    "ghiChu",
    "count",
    "created",
    "sent",
    "skipped",
    "failed",
    "errorCount",
    "readingUpdated",
    "paymentUpdated",
    "errors",
    "durationMs",
    "filename",
    "periodId",
    "nguon",
  ];

  const entries = Object.entries(meta).filter(
    ([, v]) => v != null && v !== ""
  );
  const sorted = [...entries].sort(([a], [b]) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return sorted
    .map(([k, v]) => {
      const val = formatMetaValue(k, v);
      if (!val) return null;
      return { label: META_LABELS[k] ?? k, value: val };
    })
    .filter((x): x is AuditDetailLine => x != null);
}

export function formatAuditMetadata(raw: string): string {
  const lines = metadataToDetailLines(parseAuditMetadata(raw));
  return lines.length ? lines.map((l) => `${l.label}: ${l.value}`).join(" · ") : "—";
}

export type HouseholdAuditSlice = {
  householdCode: string;
  meterCode: string;
  residentName?: string | null;
};

export function householdAuditFields(
  household: HouseholdAuditSlice
): Record<string, unknown> {
  const ten = household.residentName?.trim();
  return {
    maHo: household.householdCode,
    mkh: household.meterCode,
    ...(ten ? { tenHo: ten } : {}),
  };
}

export function meterReadingAuditMetadata(
  reading: {
    oldReading: number;
    confirmedValue: number | null;
    usageM3: number | null;
    imagePath?: string | null;
    inputMethod?: string | null;
  },
  household: HouseholdAuditSlice,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  const csm = reading.confirmedValue;
  const tieuThu =
    reading.usageM3 ??
    (csm != null ? calculateUsage(csm, reading.oldReading) : undefined);
  return {
    ...householdAuditFields(household),
    csc: reading.oldReading,
    ...(csm != null ? { csm } : {}),
    ...(tieuThu != null ? { tieuThu } : {}),
    ...(reading.imagePath ? { coAnh: true } : {}),
    ...(reading.inputMethod
      ? { phuongThuc: reading.inputMethod }
      : {}),
    ...extra,
  };
}

export function invoiceAuditMetadata(
  invoice: {
    totalAmount: number;
    usageM3: number;
    unitPrice: number;
    status: string;
  },
  household: HouseholdAuditSlice,
  period: { month: number; year: number },
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...householdAuditFields(household),
    ky: formatPeriod(period.month, period.year),
    tieuThu: invoice.usageM3,
    donGia: invoice.unitPrice,
    soTien: invoice.totalAmount,
    trangThaiHd: invoice.status,
    ...extra,
  };
}

export function periodAuditMetadata(period: {
  month: number;
  year: number;
}): Record<string, unknown> {
  return { ky: formatPeriod(period.month, period.year) };
}

export function formatMeterReadingAuditDetail(
  reading: {
    oldReading: number;
    confirmedValue: number | null;
    usageM3: number | null;
    imagePath?: string | null;
    inputMethod?: string | null;
  },
  household: HouseholdAuditSlice,
  extra?: Record<string, unknown>
): string {
  return formatAuditMetadata(
    JSON.stringify(meterReadingAuditMetadata(reading, household, extra))
  );
}

export function formatHouseholdEntitySummary(
  household: HouseholdAuditSlice
): string {
  const parts = [
    household.residentName?.trim(),
    household.householdCode,
    household.meterCode,
  ].filter((p): p is string => Boolean(p));
  return parts.join(" · ");
}

export function mergeDetailLines(
  ...groups: AuditDetailLine[][]
): AuditDetailLine[] {
  const seen = new Set<string>();
  const out: AuditDetailLine[] = [];
  for (const group of groups) {
    for (const line of group) {
      if (seen.has(line.label)) continue;
      seen.add(line.label);
      out.push(line);
    }
  }
  return out;
}
