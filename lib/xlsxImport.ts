import { PaymentMethod, Prisma } from "@prisma/client";
import { InputMethod, InvoiceStatus, ReadingStatus } from "@/lib/types/enums";
import * as XLSX from "xlsx-js-style";
import { calculateUsage } from "./billing";
import { logAudit } from "./audit";
import { periodAuditMetadata } from "./auditDisplay";
import { prisma } from "@/lib/data/prisma";
import { syncInvoiceForConfirmedReading } from "./invoices";
import { assertPriorPeriodReadingConfirmed } from "./periodChain";

type ImportRow = Record<string, unknown>;

export type PeriodXlsxImportResult = {
  readingUpdated: number;
  paymentUpdated: number;
  skipped: number;
  errors: string[];
  durationMs: number;
};

type ParsedRow = {
  line: string;
  householdCode: string;
  csm: number | null;
  markPaid: boolean;
  paymentMethod: PaymentMethod;
};

const BATCH_SIZE = 80;

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function parseNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPaidMarker(value: unknown): boolean {
  const normalized = normalizeText(value);
  return ["da thu", "dathu", "x", "yes", "y", "true", "1"].includes(normalized);
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const normalized = normalizeText(value);
  if (["tien mat", "tienmat", "tm", "cash", "c"].includes(normalized)) {
    return PaymentMethod.CASH;
  }
  return PaymentMethod.BANK_TRANSFER; // mặc định
}

function isDataSheet(name: string): boolean {
  const normalized = normalizeText(name);
  return normalized !== "tong hop" && normalized !== "huong dan";
}

function meterCodeFallback(_meterCode: string): number {
  return 0;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function parseWorkbookRows(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parsed: ParsedRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (!isDataSheet(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });

    for (const [index, row] of rows.entries()) {
      const householdCode = String(row.MKH ?? "").trim();
      if (!householdCode) continue;
      parsed.push({
        line: `${sheetName} dòng ${index + 2}`,
        householdCode,
        csm: parseNumber(row.CSM),
        markPaid: isPaidMarker(row["Đã thu (TT)"]),
        paymentMethod: parsePaymentMethod(row["Hình thức TT"]),
      });
    }
  }
  return parsed;
}

async function loadImportContext(periodId: string) {
  const period = await prisma.billingPeriod.findUniqueOrThrow({
    where: { id: periodId },
    select: { year: true, month: true },
  });

  const [households, readings, invoices, priorReadings] = await Promise.all([
    prisma.household.findMany({
      select: { id: true, householdCode: true, meterCode: true },
    }),
    prisma.meterReading.findMany({
      where: { periodId },
      select: {
        id: true,
        householdId: true,
        oldReading: true,
        status: true,
        imagePath: true,
      },
    }),
    prisma.invoice.findMany({
      where: { periodId },
      select: { id: true, householdId: true, totalAmount: true },
    }),
    prisma.meterReading.findMany({
      where: {
        status: ReadingStatus.CONFIRMED,
        confirmedValue: { not: null },
        period: {
          OR: [
            { year: { lt: period.year } },
            { year: period.year, month: { lt: period.month } },
          ],
        },
      },
      select: {
        householdId: true,
        confirmedValue: true,
      },
      orderBy: [{ period: { year: "asc" } }, { period: { month: "asc" } }],
    }),
  ]);

  const householdByCode = new Map(households.map((h) => [h.householdCode, h]));
  const readingByHousehold = new Map(readings.map((r) => [r.householdId, r]));
  const invoiceByHousehold = new Map(invoices.map((i) => [i.householdId, i]));
  const priorByHousehold = new Map<string, number>();
  for (const r of priorReadings) {
    if (r.confirmedValue != null) {
      priorByHousehold.set(r.householdId, r.confirmedValue);
    }
  }
  const meterByHousehold = new Map(households.map((h) => [h.id, h.meterCode]));

  function resolveOldReading(householdId: string, existingOld?: number): number {
    if (existingOld != null) return existingOld;
    const prior = priorByHousehold.get(householdId);
    if (prior != null) return prior;
    const meter = meterByHousehold.get(householdId);
    return meter ? meterCodeFallback(meter) : 100;
  }

  return {
    period,
    householdByCode,
    readingByHousehold,
    invoiceByHousehold,
    resolveOldReading,
  };
}

export async function importPeriodRouteWorkbook(params: {
  periodId: string;
  buffer: Buffer;
  actorId: string;
}): Promise<PeriodXlsxImportResult> {
  const started = Date.now();
  const result: PeriodXlsxImportResult = {
    readingUpdated: 0,
    paymentUpdated: 0,
    skipped: 0,
    errors: [],
    durationMs: 0,
  };

  const rows = parseWorkbookRows(params.buffer);
  if (rows.length === 0) {
    result.durationMs = Date.now() - started;
    return result;
  }

  const ctx = await loadImportContext(params.periodId);
  const readingOps: Prisma.PrismaPromise<unknown>[] = [];
  // householdId → line label + payment method (for phase 2)
  const pendingPayments: Array<{ householdId: string; line: string; paymentMethod: PaymentMethod }> = [];
  const now = new Date();

  // ── Phase 1: collect reading ops ────────────────────────────────────────────
  for (const row of rows) {
    const household = ctx.householdByCode.get(row.householdCode);
    if (!household) {
      result.errors.push(`${row.line}: không tìm thấy MKH ${row.householdCode}`);
      continue;
    }

    if (row.csm == null && !row.markPaid) {
      result.skipped++;
      continue;
    }

    if (row.csm != null) {
      try {
        await assertPriorPeriodReadingConfirmed(household.id, ctx.period);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chưa chốt kỳ trước";
        result.errors.push(`${row.line}: ${msg}`);
        continue;
      }

      const existing = ctx.readingByHousehold.get(household.id);
      const oldReading = ctx.resolveOldReading(household.id, existing?.oldReading);
      if (row.csm < oldReading) {
        result.errors.push(
          `${row.line}: CSM (${row.csm}) nhỏ hơn CSC (${oldReading})`
        );
        continue;
      }
      const usageM3 = calculateUsage(row.csm, oldReading);
      const inputMethod =
        existing?.status === ReadingStatus.PENDING && existing.imagePath
          ? InputMethod.OCR_EDITED
          : InputMethod.MANUAL;

      if (existing) {
        readingOps.push(
          prisma.meterReading.update({
            where: { id: existing.id },
            data: {
              oldReading,
              confirmedValue: row.csm,
              usageM3,
              inputMethod,
              status: ReadingStatus.CONFIRMED,
              confirmedAt: now,
              anomalyFlags: "[]",
            },
          })
        );
      } else {
        readingOps.push(
          prisma.meterReading.create({
            data: {
              householdId: household.id,
              periodId: params.periodId,
              oldReading,
              confirmedValue: row.csm!,
              usageM3,
              inputMethod,
              status: ReadingStatus.CONFIRMED,
              confirmedAt: now,
              anomalyFlags: "[]",
            },
          })
        );
      }
      result.readingUpdated++;
    }

    if (row.markPaid) {
      pendingPayments.push({ householdId: household.id, line: row.line, paymentMethod: row.paymentMethod });
    }
  }

  // Flush reading ops trước — invoice cần reading CONFIRMED để tính tiền
  for (const batch of chunk(readingOps, BATCH_SIZE)) {
    await prisma.$transaction(batch);
  }

  // ── Phase 2: sync invoices rồi mới mark paid ────────────────────────────────
  const paymentOps: Prisma.PrismaPromise<unknown>[] = [];

  for (const { householdId, line, paymentMethod } of pendingPayments) {
    // Đảm bảo invoice tồn tại (tạo mới nếu chưa có, bỏ qua nếu đã PAID)
    let invoice = await syncInvoiceForConfirmedReading(householdId, params.periodId);

    // Nếu syncInvoice trả null, thử lấy invoice hiện có (có thể đã PAID trước đó)
    if (!invoice) {
      const existing = await prisma.invoice.findUnique({
        where: { householdId_periodId: { householdId, periodId: params.periodId } },
        select: {
          id: true,
          status: true,
          usageM3: true,
          unitPrice: true,
          subtotalAmount: true,
          vatPercent: true,
          vatAmount: true,
          totalAmount: true,
        },
      });
      if (existing) {
        invoice = {
          id: existing.id,
          usageM3: existing.usageM3,
          unitPrice: existing.unitPrice,
          subtotalAmount: existing.subtotalAmount,
          vatPercent: existing.vatPercent,
          vatAmount: existing.vatAmount,
          totalAmount: existing.totalAmount,
          status: existing.status as InvoiceStatus,
        };
      }
    }

    if (!invoice) {
      result.errors.push(`${line}: không thể tạo hóa đơn (chưa có chỉ số đã chốt)`);
      continue;
    }
    if (invoice.status === InvoiceStatus.PAID) {
      // Đã thu rồi — bỏ qua, không tính lỗi
      result.paymentUpdated++;
      continue;
    }

    paymentOps.push(
      prisma.payment.upsert({
        where: { invoiceId: invoice.id },
        create: {
          invoiceId: invoice.id,
          amount: invoice.totalAmount,
          method: paymentMethod,
          note: "Import Excel",
          confirmedAt: now,
          confirmedById: params.actorId,
        },
        update: {
          confirmedAt: now,
          confirmedById: params.actorId,
          method: paymentMethod,
          note: "Import Excel",
        },
      })
    );
    paymentOps.push(
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID },
      })
    );
    result.paymentUpdated++;
  }

  for (const batch of chunk(paymentOps, BATCH_SIZE)) {
    await prisma.$transaction(batch);
  }

  await logAudit({
    actorId: params.actorId,
    action: "XLSX_IMPORT",
    entity: "Export",
    entityId: params.periodId,
    metadata: {
      ...periodAuditMetadata(ctx.period),
      readingUpdated: result.readingUpdated,
      paymentUpdated: result.paymentUpdated,
      skipped: result.skipped,
      errors: result.errors.length,
      durationMs: Date.now() - started,
    },
  });

  result.durationMs = Date.now() - started;
  return result;
}
