import type {
  HouseholdStatus,
  InvoiceStatus,
  InputMethod,
  PeriodStatus,
  ReadingStatus,
  UserRole,
} from "@/lib/types/enums";
import type { AnomalyCode } from "./anomaly";

export const appTitle = "Trạm Toàn Thắng";

/** Bật `true` để hiện mục menu Thu tiền (/admin/payments) trên header. */
export const showPaymentsNav = false;

/** Menu vận hành theo đúng quy trình thu tiền nước hàng tháng. */
export const adminNav = [
  { href: "/admin/dashboard", label: "Tổng quan" },
  { href: "/admin/billing-sheet", label: "Bảng thu nước" },
  ...(showPaymentsNav
    ? ([{ href: "/admin/payments", label: "Thu tiền" }] as const)
    : []),
  { href: "/admin/households", label: "Danh sách hộ" },
  { href: "/admin/collectors", label: "Tài khoản thu hộ" },
  { href: "/admin/area-prices", label: "Giá & VAT" },
  { href: "/admin/audit-log", label: "Nhật ký" },
] as const;

export const collectorNav = [
  { href: "/collector/billing-sheet", label: "Bảng thu nước" },
] as const;

export const residentNav = [
  { href: "/resident/submit-reading", label: "Ghi chỉ số" },
  { href: "/resident/invoices", label: "Hóa đơn" },
] as const;

export function formatPeriod(month: number, year: number): string {
  return `Tháng ${month}/${year}`;
}

export function readingStatusLabel(status: ReadingStatus | string): string {
  const map: Record<string, string> = {
    PENDING: "Chờ xử lý",
    CONFIRMED: "Đã xác nhận",
    REJECTED: "Từ chối",
  };
  return map[status];
}

export function invoiceStatusLabel(status: InvoiceStatus | string): string {
  const map: Record<string, string> = {
    DRAFT: "Nháp",
    ISSUED: "Chưa thanh toán",
    PAID: "Đã thanh toán",
    CANCELLED: "Đã hủy",
  };
  return map[status];
}

export function inputMethodLabel(method: InputMethod | string): string {
  const map: Record<string, string> = {
    OCR_CONFIRMED: "Xác nhận OCR",
    OCR_EDITED: "Sửa sau OCR",
    MANUAL: "Nhập tay",
  };
  return map[method];
}

export function anomalyLabel(code: AnomalyCode): string {
  const map: Record<AnomalyCode, string> = {
    NEGATIVE_USAGE: "Chỉ số giảm",
    HIGH_USAGE: "Tiêu thụ cao bất thường",
    ZERO_USAGE: "Không tiêu thụ",
    NEW_CUSTOMER: "Hộ mới / thiếu lịch sử",
  };
  return map[code];
}

export function userRoleLabel(role: UserRole | string): string {
  if (role === "ADMIN") return "Quản trị";
  if (role === "COLLECTOR") return "Người thu";
  return "Hộ dân";
}

export function householdStatusLabel(status: HouseholdStatus | string): string {
  return status === "ACTIVE" ? "Đang sử dụng" : "Ngưng sử dụng";
}

export function householdInactiveFromLabel(
  year: number | null | undefined,
  month: number | null | undefined
): string | null {
  if (year == null || month == null) return null;
  return `Ngưng từ ${formatPeriod(month, year)}`;
}

export function periodStatusLabel(status: PeriodStatus | string): string {
  return status === "OPEN" ? "Đang mở" : "Đã đóng";
}

export function auditActionLabel(action: string): string {
  const map: Record<string, string> = {
    READING_CONFIRMED: "Chốt chỉ số",
    READING_SUBMITTED: "Hộ gửi chỉ số",
    READING_REJECTED: "Từ chối chỉ số",
    INVOICES_GENERATED: "Chốt hóa đơn kỳ",
    INVOICE_EXPORT_LOCAL: "Xuất PDF hóa đơn",
    INVOICE_SEND_BANK_TRANSFER: "Gửi QR chuyển khoản",
    INVOICES_ZALO_SENT: "Gửi hóa đơn Zalo",
    PERIOD_CLOSED: "Đóng kỳ",
    PAYMENT_CONFIRMED: "Xác nhận thanh toán",
    SHEETS_EXPORT: "Xuất báo cáo",
    XLSX_EXPORT: "Xuất Excel",
    XLSX_IMPORT: "Nhập Excel kỳ thu",
    SETTINGS_UPDATED: "Cập nhật cài đặt",
    COLLECTOR_CREATED: "Tạo tài khoản thu hộ",
    COLLECTOR_DEACTIVATED: "Đóng tài khoản thu hộ",
    COLLECTOR_REACTIVATED: "Mở lại tài khoản thu hộ",
    COLLECTOR_ROUTES_UPDATED: "Cập nhật khu vực thu hộ",
    HOUSEHOLD_CREATED: "Thêm hộ mới",
    HOUSEHOLD_DEACTIVATED: "Ngưng sử dụng hộ",
    HOUSEHOLD_REACTIVATED: "Kích hoạt lại hộ",
    HOUSEHOLD_DELETED: "Xóa hộ",
    HOUSEHOLD_PAYMENT_METHOD_UPDATED: "Đổi hình thức thu hộ",
  };
  return map[action] ?? action;
}

export function entityLabel(entity: string): string {
  const map: Record<string, string> = {
    MeterReading: "Chỉ số đồng hồ",
    Invoice: "Hóa đơn",
    Payment: "Thanh toán",
    Export: "Xuất / nhập dữ liệu",
    BillingPeriod: "Kỳ thu",
    SystemSettings: "Cài đặt hệ thống",
    Household: "Hộ dân",
  };
  return map[entity] ?? entity;
}

export function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: "Tiền mặt",
    BANK_TRANSFER: "Chuyển khoản",
    TRANSFER: "Chuyển khoản", // legacy alias
  };
  return map[method] ?? method;
}
