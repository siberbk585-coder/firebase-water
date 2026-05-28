/** Múi giờ Việt Nam (GMT+7). */
export const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Hiển thị ngày giờ theo giờ VN — dùng cho nhật ký hệ thống, export Excel, v.v. */
export function formatDateTimeVN(
  d: Date | null | undefined,
  opts?: {
    dateStyle?: "short" | "medium" | "long";
    timeStyle?: "short" | "medium" | "long";
  },
): string {
  if (!d) return "";
  return d.toLocaleString("vi-VN", {
    timeZone: VN_TIMEZONE,
    dateStyle: opts?.dateStyle ?? "short",
    timeStyle: opts?.timeStyle ?? "medium",
  });
}
