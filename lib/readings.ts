import { InputMethod, InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import { prisma } from "./db";
import { detectAnomalies } from "./anomaly";
import { calculateUsage } from "./billing";
import { buildImageFilename } from "./filename";
import { uploadReadingImageViaN8n } from "./imageUpload";
import { logAudit } from "./audit";
import { isHouseholdBillableInPeriod } from "./householdBillable";
import { meterReadingAuditMetadata } from "./auditDisplay";
import { assertPriorPeriodReadingConfirmed } from "./periodChain";
import { formatPeriod } from "./vi";

/** CSC khi hộ/chỉ số chưa có kỳ CONFIRMED trước đó (không dùng số giả từ mã đồng hồ). */
export const DEFAULT_OLD_READING_NO_PRIOR = 0;

export async function getAvgUsage3Months(
  householdId: string,
  beforePeriodId: string
): Promise<number | null> {
  const before = await prisma.billingPeriod.findUnique({ where: { id: beforePeriodId } });
  if (!before) return null;

  const prior = await prisma.meterReading.findMany({
    where: {
      householdId,
      status: ReadingStatus.CONFIRMED,
      period: {
        OR: [
          { year: { lt: before.year } },
          { year: before.year, month: { lt: before.month } },
        ],
      },
    },
    include: { period: true },
    orderBy: [{ period: { year: "desc" } }, { period: { month: "desc" } }],
    take: 3,
  });

  const usages = prior.map((r) => r.usageM3).filter((u): u is number => u != null);
  if (!usages.length) return null;
  return usages.reduce((a, b) => a + b, 0) / usages.length;
}

/** CSC hiển thị / tính tiền: đã chốt hoặc CSC thủ công giữ giá trị đã lưu; còn lại lấy chuỗi kỳ trước. */
export function resolveOldReadingForRow(
  reading: { status: ReadingStatus; oldReading: number; cscManual?: boolean } | null,
  chainOldReading: number
): number {
  if (!reading) return chainOldReading;
  if (reading.cscManual || reading.status === ReadingStatus.CONFIRMED) {
    return reading.oldReading;
  }
  return chainOldReading;
}

/**
 * Sau khi chốt kỳ N: cập nhật CSC các kỳ sau (PENDING/REJECTED) = CSM vừa chốt.
 * VD: T4 chốt 160 → T5, T6 (chưa chốt) có CSC 160; T5 chốt 165 → T6 có CSC 165.
 */
export async function propagateOldReadingAfterConfirm(
  householdId: string,
  confirmedPeriod: { year: number; month: number },
  confirmedValue: number
): Promise<number> {
  const result = await prisma.meterReading.updateMany({
    where: {
      householdId,
      status: { in: [ReadingStatus.PENDING, ReadingStatus.REJECTED] },
      period: {
        OR: [
          { year: { gt: confirmedPeriod.year } },
          {
            year: confirmedPeriod.year,
            month: { gt: confirmedPeriod.month },
          },
        ],
      },
    },
    data: { oldReading: confirmedValue },
  });
  return result.count;
}

export async function getOldReading(householdId: string, periodId: string): Promise<number> {
  const period = await prisma.billingPeriod.findUniqueOrThrow({ where: { id: periodId } });
  const prev = await prisma.meterReading.findFirst({
    where: {
      householdId,
      status: ReadingStatus.CONFIRMED,
      period: {
        OR: [
          { year: { lt: period.year } },
          { year: period.year, month: { lt: period.month } },
        ],
      },
    },
    include: { period: true },
    orderBy: [{ period: { year: "desc" } }, { period: { month: "desc" } }],
  });
  if (prev?.confirmedValue != null) return prev.confirmedValue;
  return DEFAULT_OLD_READING_NO_PRIOR;
}

export async function confirmReading(params: {
  readingId: string;
  confirmedValue: number;
  inputMethod: InputMethod;
  actorId?: string;
}) {
  const reading = await prisma.meterReading.findUniqueOrThrow({
    where: { id: params.readingId },
    include: { household: true, period: true },
  });

  await assertPriorPeriodReadingConfirmed(reading.householdId, reading.period);

  const oldReading = reading.cscManual
    ? reading.oldReading
    : await getOldReading(reading.householdId, reading.periodId);

  const avg = await getAvgUsage3Months(reading.householdId, reading.periodId);
  const anomaly = detectAnomalies({
    oldReading,
    newReading: params.confirmedValue,
    avgUsage3Months: avg,
  });

  if (anomaly.reject) {
    await prisma.meterReading.update({
      where: { id: reading.id },
      data: { status: ReadingStatus.REJECTED, anomalyFlags: JSON.stringify(anomaly.flags) },
    });
    throw new Error(anomaly.message ?? "Không thể lưu chỉ số");
  }

  const usageM3 = calculateUsage(params.confirmedValue, oldReading);

  const updated = await prisma.meterReading.update({
    where: { id: reading.id },
    data: {
      oldReading,
      confirmedValue: params.confirmedValue,
      inputMethod: params.inputMethod,
      usageM3,
      anomalyFlags: JSON.stringify(anomaly.flags),
      status: ReadingStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
  });

  await propagateOldReadingAfterConfirm(
    reading.householdId,
    { year: reading.period.year, month: reading.period.month },
    params.confirmedValue
  );

  return updated;
}

export function readingLastUpdatedAt(reading: {
  submittedAt: Date;
  confirmedAt: Date | null;
}): Date {
  return reading.confirmedAt ?? reading.submittedAt;
}

/**
 * Hộ dân gửi CSM → PENDING (chờ tổ trưởng/kế toán chốt).
 * Có ảnh → n8n → imagePath; không ảnh → bỏ qua n8n.
 */
export async function submitManualReading(params: {
  householdId: string;
  periodId: string;
  confirmedValue: number;
  imageBuffer?: Buffer;
  fileExt?: string;
  actorId?: string;
}) {
  const [household, period] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: params.householdId },
      select: {
        householdCode: true,
        meterCode: true,
        residentName: true,
        status: true,
        inactiveFromYear: true,
        inactiveFromMonth: true,
      },
    }),
    prisma.billingPeriod.findUniqueOrThrow({
      where: { id: params.periodId },
      select: { year: true, month: true },
    }),
  ]);

  if (!isHouseholdBillableInPeriod(household, period.year, period.month)) {
    throw new Error("Hộ đã ngưng sử dụng — không thể gửi chỉ số kỳ này.");
  }

  const oldReading = await getOldReading(params.householdId, params.periodId);

  if (params.confirmedValue <= oldReading) {
    throw new Error(`CSM phải cao hơn CSC (${oldReading})`);
  }

  let imagePath: string | undefined;
  if (params.imageBuffer?.length) {
    const ext = params.fileExt || "jpg";
    imagePath = await uploadReadingImageViaN8n(params.imageBuffer, {
      filename: buildImageFilename({
        prefix: "reading",
        code: household.householdCode,
        ext,
      }),
      householdId: params.householdId,
      periodId: params.periodId,
      householdCode: household.householdCode,
      confirmedValue: params.confirmedValue,
    });
  }

  const existing = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: {
        householdId: params.householdId,
        periodId: params.periodId,
      },
    },
  });

  const inputMethod =
    imagePath || existing?.imagePath ? InputMethod.OCR_EDITED : InputMethod.MANUAL;

  const reading = existing
    ? await prisma.meterReading.update({
        where: { id: existing.id },
        data: {
          oldReading,
          confirmedValue: params.confirmedValue,
          inputMethod,
          ...(imagePath ? { imagePath } : {}),
          submittedAt: new Date(),
          status: ReadingStatus.PENDING,
          usageM3: null,
          confirmedAt: null,
          anomalyFlags: "[]",
        },
      })
    : await prisma.meterReading.create({
        data: {
          householdId: params.householdId,
          periodId: params.periodId,
          oldReading,
          confirmedValue: params.confirmedValue,
          inputMethod,
          imagePath: imagePath ?? null,
          status: ReadingStatus.PENDING,
          anomalyFlags: "[]",
        },
      });

  if (params.actorId) {
    await logAudit({
      actorId: params.actorId,
      action: "READING_SUBMITTED",
      entity: "MeterReading",
      entityId: reading.id,
      metadata: meterReadingAuditMetadata(reading, household, {
        coAnh: Boolean(imagePath),
        ky: formatPeriod(period.month, period.year),
        phuongThuc: inputMethod,
      }),
    });
  }

  return reading;
}

/** Tổ trưởng / kế toán chốt chỉ số hộ đã gửi. */
export async function approveReading(params: {
  readingId: string;
  actorId: string;
  confirmedValue?: number;
}) {
  const existing = await prisma.meterReading.findUniqueOrThrow({
    where: { id: params.readingId },
    include: {
      household: { select: { householdCode: true, meterCode: true, residentName: true } },
      period: { select: { month: true, year: true } },
    },
  });
  if (existing.status !== ReadingStatus.PENDING) {
    throw new Error("Chỉ duyệt được chỉ số đang chờ xử lý");
  }

  const paidInvoice = await prisma.invoice.findFirst({
    where: {
      householdId: existing.householdId,
      periodId: existing.periodId,
      status: InvoiceStatus.PAID,
    },
    select: { id: true },
  });
  if (paidInvoice) {
    throw new Error("Không thể chốt lại — hóa đơn kỳ này đã được xác nhận thu");
  }
  const value = params.confirmedValue ?? existing.confirmedValue;
  if (value == null) throw new Error("Thiếu chỉ số mới (CSM)");

  const inputMethod =
    existing.imagePath && existing.inputMethod === InputMethod.OCR_EDITED
      ? InputMethod.OCR_EDITED
      : InputMethod.MANUAL;

  const reading = await confirmReading({
    readingId: existing.id,
    confirmedValue: value,
    inputMethod,
    actorId: params.actorId,
  });

  await logAudit({
    actorId: params.actorId,
    action: "READING_CONFIRMED",
    entity: "MeterReading",
    entityId: reading.id,
    metadata: meterReadingAuditMetadata(reading, existing.household, {
      ky: formatPeriod(existing.period.month, existing.period.year),
      phuongThuc: inputMethod,
    }),
  });

  return reading;
}

/** Từ chối — hộ có thể gửi lại. */
export async function rejectReading(params: {
  readingId: string;
  actorId: string;
  reason?: string;
}) {
  const existing = await prisma.meterReading.findUniqueOrThrow({
    where: { id: params.readingId },
    include: {
      household: { select: { householdCode: true, meterCode: true, residentName: true } },
      period: { select: { month: true, year: true } },
    },
  });
  if (existing.status !== ReadingStatus.PENDING) {
    throw new Error("Chỉ từ chối được chỉ số đang chờ xử lý");
  }

  const reading = await prisma.meterReading.update({
    where: { id: existing.id },
    data: {
      status: ReadingStatus.REJECTED,
      anomalyFlags: "[]",
      usageM3: null,
      confirmedAt: null,
    },
  });

  await logAudit({
    actorId: params.actorId,
    action: "READING_REJECTED",
    entity: "MeterReading",
    entityId: reading.id,
    metadata: meterReadingAuditMetadata(reading, existing.household, {
      ky: formatPeriod(existing.period.month, existing.period.year),
      ...(params.reason ? { lyDo: params.reason } : {}),
    }),
  });

  return reading;
}

/** Nhân viên nhập/xác nhận CSM trên bảng tuyến — không bắt buộc ảnh. */
export async function adminUpsertReading(params: {
  householdId: string;
  periodId: string;
  confirmedValue: number;
  actorId: string;
  auditExtra?: Record<string, unknown>;
  /** ADMIN — cho phép sửa hộ đã xác nhận thu tiền */
  allowPaidEdit?: boolean;
}) {
  const paidInvoice = await prisma.invoice.findFirst({
    where: {
      householdId: params.householdId,
      periodId: params.periodId,
      status: InvoiceStatus.PAID,
    },
    select: { id: true },
  });
  if (paidInvoice && !params.allowPaidEdit) {
    throw new Error("Không thể chốt lại — hóa đơn kỳ này đã được xác nhận thu");
  }

  const [household, period] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: params.householdId },
      select: { householdCode: true, meterCode: true, residentName: true },
    }),
    prisma.billingPeriod.findUniqueOrThrow({
      where: { id: params.periodId },
      select: { month: true, year: true },
    }),
  ]);

  const existing = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: {
        householdId: params.householdId,
        periodId: params.periodId,
      },
    },
  });

  const oldReading =
    existing?.cscManual === true
      ? existing.oldReading
      : await getOldReading(params.householdId, params.periodId);

  const draft = existing
    ? await prisma.meterReading.update({
        where: { id: existing.id },
        data: { oldReading, anomalyFlags: "[]" },
      })
    : await prisma.meterReading.create({
        data: {
          householdId: params.householdId,
          periodId: params.periodId,
          oldReading,
          status: ReadingStatus.PENDING,
          anomalyFlags: "[]",
        },
      });

  const upsertInputMethod =
    existing?.status === ReadingStatus.PENDING && existing.imagePath
      ? InputMethod.OCR_EDITED
      : InputMethod.MANUAL;

  const reading = await confirmReading({
    readingId: draft.id,
    confirmedValue: params.confirmedValue,
    inputMethod: upsertInputMethod,
    actorId: params.actorId,
  });

  await logAudit({
    actorId: params.actorId,
    action: "READING_CONFIRMED",
    entity: "MeterReading",
    entityId: reading.id,
    metadata: meterReadingAuditMetadata(reading, household, {
      ky: formatPeriod(period.month, period.year),
      phuongThuc: upsertInputMethod,
      ...params.auditExtra,
    }),
  });

  return reading;
}

/** Admin điều chỉnh CSC (thay đồng hồ / sửa sự cố). Không propagate sang kỳ sau. */
export async function adminAdjustOldReading(params: {
  householdId: string;
  periodId: string;
  oldReading: number;
  reason: string;
  actorId: string;
  auditExtra?: Record<string, unknown>;
  allowPaidEdit?: boolean;
}) {
  const reason = params.reason.trim();
  if (reason.length < 3) {
    throw new Error("Ghi lý do điều chỉnh CSC (ít nhất 3 ký tự)");
  }
  if (params.oldReading < 0 || !Number.isFinite(params.oldReading)) {
    throw new Error("CSC không hợp lệ");
  }

  const paidInvoice = await prisma.invoice.findFirst({
    where: {
      householdId: params.householdId,
      periodId: params.periodId,
      status: InvoiceStatus.PAID,
    },
    select: { id: true },
  });
  if (paidInvoice && !params.allowPaidEdit) {
    throw new Error("Không thể sửa CSC — hóa đơn kỳ này đã được xác nhận thu");
  }

  const [household, period] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: params.householdId },
      select: { householdCode: true, meterCode: true, residentName: true },
    }),
    prisma.billingPeriod.findUniqueOrThrow({
      where: { id: params.periodId },
      select: { month: true, year: true },
    }),
  ]);

  const existing = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: {
        householdId: params.householdId,
        periodId: params.periodId,
      },
    },
  });

  const csm = existing?.confirmedValue ?? existing?.ocrValue ?? null;
  if (csm != null && params.oldReading >= csm) {
    throw new Error(`CSC phải nhỏ hơn CSM (${csm})`);
  }

  const priorOld = existing?.oldReading;
  const usageM3 =
    csm != null && existing?.status === ReadingStatus.CONFIRMED
      ? calculateUsage(csm, params.oldReading)
      : null;

  const reading = existing
    ? await prisma.meterReading.update({
        where: { id: existing.id },
        data: {
          oldReading: params.oldReading,
          cscManual: true,
          ...(usageM3 != null ? { usageM3 } : {}),
        },
      })
    : await prisma.meterReading.create({
        data: {
          householdId: params.householdId,
          periodId: params.periodId,
          oldReading: params.oldReading,
          cscManual: true,
          status: ReadingStatus.PENDING,
          anomalyFlags: "[]",
        },
      });

  await logAudit({
    actorId: params.actorId,
    action: "READING_CSC_ADJUSTED",
    entity: "MeterReading",
    entityId: reading.id,
    metadata: meterReadingAuditMetadata(reading, household, {
      ky: formatPeriod(period.month, period.year),
      lyDo: reason,
      ...(priorOld != null && priorOld !== params.oldReading
        ? { cscTruoc: priorOld }
        : {}),
      ...params.auditExtra,
    }),
  });

  return reading;
}
