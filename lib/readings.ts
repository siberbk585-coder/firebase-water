import { InputMethod, InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import { prisma } from "./db";
import { detectAnomalies } from "./anomaly";
import { calculateUsage } from "./billing";
import { buildImageFilename } from "./filename";
import { uploadReadingImageViaN8n } from "./imageUpload";
import { logAudit } from "./audit";
import { meterReadingAuditMetadata } from "./auditDisplay";
import { assertPriorPeriodReadingConfirmed } from "./periodChain";

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
  const household = await prisma.household.findUniqueOrThrow({ where: { id: householdId } });
  const base = parseInt(household.meterCode.replace(/\D/g, "").slice(-3) || "100", 10);
  return 100 + (base % 50);
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

  const avg = await getAvgUsage3Months(reading.householdId, reading.periodId);
  const anomaly = detectAnomalies({
    oldReading: reading.oldReading,
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

  const usageM3 = calculateUsage(params.confirmedValue, reading.oldReading);

  return prisma.meterReading.update({
    where: { id: reading.id },
    data: {
      confirmedValue: params.confirmedValue,
      inputMethod: params.inputMethod,
      usageM3,
      anomalyFlags: JSON.stringify(anomaly.flags),
      status: ReadingStatus.CONFIRMED,
      confirmedAt: new Date(),
    },
  });
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
  const household = await prisma.household.findUniqueOrThrow({
    where: { id: params.householdId },
    select: { householdCode: true, meterCode: true },
  });

  const oldReading = await getOldReading(params.householdId, params.periodId);

  if (params.confirmedValue < oldReading) {
    throw new Error(`CSM phải ≥ CSC (${oldReading})`);
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
      household: { select: { householdCode: true, meterCode: true } },
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
    metadata: meterReadingAuditMetadata(reading, existing.household),
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
      household: { select: { householdCode: true, meterCode: true } },
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
}) {
  const paidInvoice = await prisma.invoice.findFirst({
    where: {
      householdId: params.householdId,
      periodId: params.periodId,
      status: InvoiceStatus.PAID,
    },
    select: { id: true },
  });
  if (paidInvoice) {
    throw new Error("Không thể chốt lại — hóa đơn kỳ này đã được xác nhận thu");
  }

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: params.householdId },
    select: { householdCode: true, meterCode: true },
  });

  const oldReading = await getOldReading(params.householdId, params.periodId);

  const existing = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: {
        householdId: params.householdId,
        periodId: params.periodId,
      },
    },
  });

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

  const reading = await confirmReading({
    readingId: draft.id,
    confirmedValue: params.confirmedValue,
    inputMethod:
      existing?.status === ReadingStatus.PENDING && existing.imagePath
        ? InputMethod.OCR_EDITED
        : InputMethod.MANUAL,
    actorId: params.actorId,
  });

  await logAudit({
    actorId: params.actorId,
    action: "READING_CONFIRMED",
    entity: "MeterReading",
    entityId: reading.id,
    metadata: meterReadingAuditMetadata(reading, household),
  });

  return reading;
}
