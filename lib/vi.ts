import type {
  HouseholdStatus,
  InvoiceStatus,
  InputMethod,
  PeriodStatus,
  ReadingStatus,
  UserRole,
} from "@/lib/types/enums";
import type { AnomalyCode } from "./anomaly";

export const appTitle = "Thu tiền nước";

/** Menu vận hành theo đúng quy trình thu tiền nước hàng tháng. */
export const adminNav = [
  { href: "/admin/dashboard", label: "Tổng quan" },
  { href: "/admin/billing-sheet", label: "Bảng thu nước" },
  { href: "/admin/payments", label: "Thu tiền" },
  { href: "/admin/households", label: "Danh sách hộ" },
  { href: "/admin/area-prices", label: "Giá khu vực" },
  { href: "/admin/audit-log", label: "Nhật ký" },
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
  return role === "ADMIN" ? "Quản trị" : "Hộ dân";
}

export function householdStatusLabel(status: HouseholdStatus | string): string {
  return status === "ACTIVE" ? "Đang sử dụng" : "Ngừng";
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
    INVOICES_ZALO_SENT: "Gửi hóa đơn Zalo",
    PERIOD_CLOSED: "Đóng kỳ",
    PAYMENT_CONFIRMED: "Xác nhận thanh toán",
    SHEETS_EXPORT: "Xuất báo cáo",
    XLSX_EXPORT: "Xuất Excel",
    XLSX_IMPORT: "Nhập Excel kỳ thu",
    SETTINGS_UPDATED: "Cập nhật cài đặt",
    HOUSEHOLD_CREATED: "Thêm hộ mới",
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
