import { PeriodStatus } from "@/lib/types/enums";;
import { prisma } from "./db";

const SETTINGS_ID = "default";

export async function getSystemSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, vatPercent: 5 },
    update: {},
  });
}

export async function updateSystemSettings(data: {
  periodCloseDay?: number;
  timezone?: string;
  vatPercent?: number;
}) {
  const day = data.periodCloseDay;
  if (day != null && (day < 1 || day > 28)) {
    throw new Error("Ngày đóng kỳ phải từ 1 đến 28");
  }
  if (data.vatPercent != null && (data.vatPercent < 0 || data.vatPercent > 100)) {
    throw new Error("Thuế VAT phải từ 0 đến 100%");
  }
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      periodCloseDay: day ?? 25,
      timezone: data.timezone ?? "Asia/Ho_Chi_Minh",
      vatPercent: data.vatPercent ?? 5,
    },
    update: {
      ...(day != null ? { periodCloseDay: day } : {}),
      ...(data.timezone ? { timezone: data.timezone } : {}),
      ...(data.vatPercent != null ? { vatPercent: data.vatPercent } : {}),
    },
  });
}

/** Hộ có được gửi chỉ số trong kỳ OPEN không (trước ngày đóng kỳ). */
export async function canResidentSubmitForPeriod(period: {
  status: PeriodStatus;
  month: number;
  year: number;
}): Promise<{ allowed: boolean; reason?: string }> {
  if (period.status === PeriodStatus.CLOSED) {
    return { allowed: false, reason: "Kỳ đã đóng — không gửi chỉ số được nữa." };
  }

  const settings = await getSystemSettings();
  const now = new Date();
  const closeDay = settings.periodCloseDay;

  if (period.year < now.getFullYear()) {
    return { allowed: false, reason: "Kỳ cũ đã qua — liên hệ nhân viên thu nước." };
  }
  if (period.year === now.getFullYear() && period.month < now.getMonth() + 1) {
    return { allowed: false, reason: "Kỳ tháng trước — liên hệ nhân viên nếu cần gửi bổ sung." };
  }

  if (period.year === now.getFullYear() && period.month === now.getMonth() + 1) {
    if (now.getDate() > closeDay) {
      return {
        allowed: false,
        reason: `Quá ngày đóng kỳ (ngày ${closeDay}) — liên hệ nhân viên thu nước.`,
      };
    }
  }

  return { allowed: true };
}
