import { PeriodStatus } from "@/lib/types/enums";;
import { prisma } from "./db";

const SETTINGS_ID = "default";

export async function getSystemSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

export async function updateSystemSettings(data: {
  periodCloseDay?: number;
  timezone?: string;
}) {
  const day = data.periodCloseDay;
  if (day != null && (day < 1 || day > 28)) {
    throw new Error("Ngày đóng kỳ phải từ 1 đến 28");
  }
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      periodCloseDay: day ?? 25,
      timezone: data.timezone ?? "Asia/Ho_Chi_Minh",
    },
    update: {
      ...(day != null ? { periodCloseDay: day } : {}),
      ...(data.timezone ? { timezone: data.timezone } : {}),
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
