import type { AuditLog, User } from "@prisma/client";
import { prisma } from "./db";
import {
  invoiceAuditMetadata,
  isEmptyAuditMetadata,
  mergeDetailLines,
  metadataToDetailLines,
  meterReadingAuditMetadata,
  parseAuditMetadata,
  formatHouseholdEntitySummary,
  periodAuditMetadata,
  type AuditDetailLine,
} from "./auditDisplay";
import { formatPeriod } from "./vi";

type AuditLogRow = AuditLog & {
  actor: Pick<User, "name" | "phone" | "role"> | null;
};

export type EnrichedAuditRow = {
  log: AuditLogRow;
  lines: AuditDetailLine[];
  entityHref: string | null;
  entitySummary: string | null;
};

function billingSheetHref(periodId: string, q?: string): string {
  const params = new URLSearchParams({ period: periodId });
  if (q) params.set("q", q);
  return `/admin/billing-sheet?${params}`;
}

export async function enrichAuditLogRows(
  logs: AuditLogRow[]
): Promise<EnrichedAuditRow[]> {
  const readingIds = [
    ...new Set(
      logs
        .filter((l) => l.entity === "MeterReading" && l.entityId)
        .map((l) => l.entityId as string)
    ),
  ];
  const invoiceIds = [
    ...new Set(
      logs
        .filter((l) => l.entity === "Invoice" && l.entityId)
        .map((l) => l.entityId as string)
    ),
  ];
  const periodIds = [
    ...new Set(
      logs
        .filter((l) => l.entity === "BillingPeriod" && l.entityId)
        .map((l) => l.entityId as string)
    ),
  ];
  const householdIds = [
    ...new Set(
      logs
        .filter((l) => l.entity === "Household" && l.entityId)
        .map((l) => l.entityId as string)
    ),
  ];

  const metaPeriodIds = [
    ...new Set(
      logs
        .map((l) => parseAuditMetadata(l.metadata).periodId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ].filter((id) => !periodIds.includes(id));

  const [readings, invoices, periods, households] = await Promise.all([
      readingIds.length
        ? prisma.meterReading.findMany({
            where: { id: { in: readingIds } },
            include: {
              household: {
                select: {
                  id: true,
                  householdCode: true,
                  meterCode: true,
                  residentName: true,
                },
              },
              period: { select: { id: true, month: true, year: true } },
            },
          })
        : [],
      invoiceIds.length
        ? prisma.invoice.findMany({
            where: { id: { in: invoiceIds } },
            include: {
              household: {
                select: {
                  id: true,
                  householdCode: true,
                  meterCode: true,
                  residentName: true,
                },
              },
              period: { select: { id: true, month: true, year: true } },
            },
          })
        : [],
      [...periodIds, ...metaPeriodIds].length
        ? prisma.billingPeriod.findMany({
            where: { id: { in: [...periodIds, ...metaPeriodIds] } },
            select: { id: true, month: true, year: true },
          })
        : [],
      householdIds.length
        ? prisma.household.findMany({
            where: { id: { in: householdIds } },
            select: {
              id: true,
              householdCode: true,
              meterCode: true,
              residentName: true,
            },
          })
        : [],
    ]);

  const readingsById = new Map(readings.map((r) => [r.id, r] as const));
  const invoicesById = new Map(invoices.map((i) => [i.id, i] as const));
  const periodsById = new Map(periods.map((p) => [p.id, p] as const));
  const householdsById = new Map(households.map((h) => [h.id, h] as const));

  return logs.map((log) => {
    const meta = parseAuditMetadata(log.metadata);
    const metaLines = metadataToDetailLines(meta);

    let dbLines: AuditDetailLine[] = [];
    let entityHref: string | null = null;
    let entitySummary: string | null = null;

    if (log.entity === "MeterReading" && log.entityId) {
      const reading = readingsById.get(log.entityId);
      if (reading) {
        dbLines = metadataToDetailLines(
          meterReadingAuditMetadata(reading, reading.household, {
            ky: formatPeriod(reading.period.month, reading.period.year),
          })
        );
        entitySummary = formatHouseholdEntitySummary(reading.household);
        entityHref = billingSheetHref(
          reading.period.id,
          reading.household.meterCode
        );
      }
    } else if (log.entity === "Invoice" && log.entityId) {
      const inv = invoicesById.get(log.entityId);
      if (inv) {
        dbLines = metadataToDetailLines(
          invoiceAuditMetadata(inv, inv.household, inv.period)
        );
        entitySummary = [
          inv.household.residentName?.trim(),
          inv.household.householdCode,
          formatPeriod(inv.period.month, inv.period.year),
        ]
          .filter(Boolean)
          .join(" · ");
        entityHref = billingSheetHref(inv.period.id, inv.household.meterCode);
      }
    } else if (log.entity === "BillingPeriod" && log.entityId) {
      const period = periodsById.get(log.entityId);
      if (period) {
        dbLines = metadataToDetailLines(periodAuditMetadata(period));
        entitySummary = formatPeriod(period.month, period.year);
        entityHref = billingSheetHref(period.id);
      }
    } else if (log.entity === "Household" && log.entityId) {
      const h = householdsById.get(log.entityId);
      if (h) {
        dbLines = metadataToDetailLines({
          tenHo: h.residentName,
          maHo: h.householdCode,
          mkh: h.meterCode,
        });
        entitySummary = formatHouseholdEntitySummary(h);
        entityHref = `/admin/households/${h.id}`;
      }
    } else if (log.entity === "Export") {
      const periodId =
        typeof meta.periodId === "string" ? meta.periodId : log.entityId;
      if (periodId) {
        const period = periodsById.get(periodId);
        if (period) {
          const kyLine = metadataToDetailLines(periodAuditMetadata(period));
          dbLines = mergeDetailLines(dbLines, kyLine);
          entitySummary = formatPeriod(period.month, period.year);
          entityHref = billingSheetHref(period.id);
        }
      }
    }

    const lines =
      isEmptyAuditMetadata(log.metadata) && dbLines.length
        ? dbLines
        : mergeDetailLines(dbLines, metaLines);

    if (!entitySummary && lines.length) {
      const tenHo = lines.find((l) => l.label === "Tên hộ")?.value;
      const maHo = lines.find((l) => l.label === "Mã hộ")?.value;
      const mkh = lines.find((l) => l.label === "Đồng hồ")?.value;
      entitySummary = [tenHo, maHo, mkh].filter(Boolean).join(" · ") || null;
    }

    return { log, lines, entityHref, entitySummary };
  });
}
