import { InvoiceStatus, ReadingStatus } from "@/lib/types/enums";;
import { prisma } from "./db";
import { calculateUsage } from "./billing";
import {
  calculateBillingAmounts,
  invoiceNeedsVatBackfill,
  resolveInvoiceAmounts,
} from "./vat";
import { getVatPercent } from "./vatServer";
import {
  currentCalendarPeriod,
  ensureActiveHouseholdsInPeriod,
  ensureCurrentBillingPeriod,
} from "./billingPeriods";
import { unitPriceForHousehold } from "./routePricing";

export { currentCalendarPeriod, ensureCurrentBillingPeriod };

export type BillingSheetRow = {
  householdId: string;
  meterCode: string;
  routeName: string | null;
  routeSortOrder: number | null;
  residentName: string;
  address: string;
  contactPhone: string | null;
  householdCode: string;
  unitPrice: number;
  oldReading: number;
  readingId: string | null;
  csm: number | null;
  status: ReadingStatus | null;
  usageM3: number | null;
  totalAmount: number | null;
  subtotalAmount: number | null;
  vatAmount: number | null;
  vatPercent: number | null;
  hasImage: boolean;
  imagePath: string | null;
  invoiceId: string | null;
  invoiceStatus: InvoiceStatus | null;
  pdfPath: string | null;
  paid: boolean;
  paymentMethod: string | null;
};

export type RouteSummary = {
  routeId: string;
  routeName: string;
  routeCode: string;
  householdCount: number;
  recordedCount: number;
  pendingCount: number;
  totalUsageM3: number;
  totalAmount: number;
};

export async function getBillingPeriods() {
  await ensureCurrentBillingPeriod();
  return prisma.billingPeriod.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getCollectionRoutes() {
  return prisma.collectionRoute.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function loadBillingSheetRows(
  periodId: string,
  routeId: string | null
): Promise<BillingSheetRow[]> {
  const period = await prisma.billingPeriod.findUniqueOrThrow({ where: { id: periodId } });
  await ensureActiveHouseholdsInPeriod(periodId);
  const vatPercent = await getVatPercent();

  const households = await prisma.household.findMany({
    where: {
      status: "ACTIVE",
      ...(routeId ? { collectionRouteId: routeId } : {}),
    },
    include: {
      priceGroup: true,
      collectionRoute: { select: { name: true, unitPrice: true } },
      user: { select: { phone: true } },
      readings: {
        where: { periodId },
        take: 1,
      },
      invoices: {
        where: { periodId },
        take: 1,
        include: { payment: true },
      },
    },
    orderBy: [{ routeSortOrder: "asc" }, { householdCode: "asc" }],
  });

  const missingOldReadingHouseholdIds = households
    .filter((h) => h.readings[0]?.oldReading == null)
    .map((h) => h.id);

  const priorReadingByHousehold = new Map<string, number>();
  if (missingOldReadingHouseholdIds.length) {
    const priorReadings = await prisma.meterReading.findMany({
      where: {
        householdId: { in: missingOldReadingHouseholdIds },
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
        period: { select: { year: true, month: true } },
      },
      orderBy: [
        { householdId: "asc" },
        { period: { year: "desc" } },
        { period: { month: "desc" } },
      ],
    });

    for (const reading of priorReadings) {
      if (!priorReadingByHousehold.has(reading.householdId) && reading.confirmedValue != null) {
        priorReadingByHousehold.set(reading.householdId, reading.confirmedValue);
      }
    }
  }

  const rows: BillingSheetRow[] = [];
  for (const h of households) {
    const reading = h.readings[0] ?? null;
    const invoice = h.invoices[0] ?? null;
    const oldReading =
      reading?.oldReading ??
      priorReadingByHousehold.get(h.id) ??
      fallbackOldReadingFromMeterCode(h.meterCode);
    const csm =
      reading?.status === ReadingStatus.CONFIRMED
        ? reading.confirmedValue
        : reading?.confirmedValue ?? reading?.ocrValue ?? null;
    const usageM3 =
      csm != null ? calculateUsage(csm, oldReading) : reading?.usageM3 ?? null;
    const unitPrice = unitPriceForHousehold(h);
    let amounts: ReturnType<typeof calculateBillingAmounts> | null = null;
    if (usageM3 != null && usageM3 > 0) {
      amounts = invoice?.subtotalAmount != null
        ? resolveInvoiceAmounts(
            {
              usageM3: invoice.usageM3,
              unitPrice: invoice.unitPrice,
              subtotalAmount: invoice.subtotalAmount,
              vatPercent: invoice.vatPercent,
              vatAmount: invoice.vatAmount,
              totalAmount: invoice.totalAmount,
            },
            vatPercent
          )
        : calculateBillingAmounts(usageM3, unitPrice, vatPercent);
    } else if (usageM3 === 0) {
      amounts = { subtotal: 0, vatPercent, vatAmount: 0, totalAmount: 0 };
    }

    if (
      invoice &&
      amounts &&
      invoice.status !== InvoiceStatus.PAID &&
      invoice.status !== InvoiceStatus.CANCELLED &&
      invoiceNeedsVatBackfill(invoice, vatPercent)
    ) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotalAmount: amounts.subtotal,
          vatPercent: amounts.vatPercent,
          vatAmount: amounts.vatAmount,
          totalAmount: amounts.totalAmount,
        },
      });
    }

    rows.push({
      householdId: h.id,
      meterCode: h.meterCode,
      routeName: h.collectionRoute?.name ?? null,
      routeSortOrder: h.routeSortOrder,
      residentName: h.residentName,
      address: h.address,
      contactPhone: h.contactPhone ?? h.user?.phone ?? null,
      householdCode: h.householdCode,
      unitPrice,
      oldReading,
      readingId: reading?.id ?? null,
      csm,
      status: reading?.status ?? null,
      usageM3,
      totalAmount: amounts?.totalAmount ?? null,
      subtotalAmount: amounts?.subtotal ?? null,
      vatAmount: amounts?.vatAmount ?? null,
      vatPercent: amounts?.vatPercent ?? null,
      hasImage: Boolean(reading?.imagePath),
      imagePath: reading?.imagePath ?? null,
      invoiceId: invoice?.id ?? null,
      invoiceStatus: invoice?.status ?? null,
      pdfPath: invoice?.pdfPath ?? null,
      paid: invoice?.status === InvoiceStatus.PAID,
      paymentMethod: invoice?.payment?.method ?? null,
    });
  }
  return rows;
}

function fallbackOldReadingFromMeterCode(meterCode: string): number {
  const base = parseInt(meterCode.replace(/\D/g, "").slice(-3) || "100", 10);
  return 100 + (base % 50);
}

export async function loadRouteSummaries(periodId: string): Promise<RouteSummary[]> {
  const routes = await getCollectionRoutes();
  const summaries: RouteSummary[] = [];

  for (const route of routes) {
    const rows = await loadBillingSheetRows(periodId, route.id);
    let totalUsageM3 = 0;
    let totalAmount = 0;
    let recordedCount = 0;
    let pendingCount = 0;

    for (const r of rows) {
      if (r.csm != null) {
        recordedCount++;
        if (r.status === ReadingStatus.PENDING) pendingCount++;
        if (r.usageM3 != null) totalUsageM3 += r.usageM3;
        if (r.totalAmount != null) totalAmount += r.totalAmount;
      }
    }

    summaries.push({
      routeId: route.id,
      routeName: route.name,
      routeCode: route.code,
      householdCount: rows.length,
      recordedCount,
      pendingCount,
      totalUsageM3,
      totalAmount,
    });
  }

  const noRoute = await prisma.household.count({
    where: { status: "ACTIVE", collectionRouteId: null },
  });
  if (noRoute > 0) {
    const vatPercent = await getVatPercent();
    const rows = await prisma.household.findMany({
      where: { status: "ACTIVE", collectionRouteId: null },
      include: {
        readings: { where: { periodId }, take: 1 },
        priceGroup: true,
      },
    });
    let totalUsageM3 = 0;
    let totalAmount = 0;
    let recordedCount = 0;
    let pendingCount = 0;
    for (const h of rows) {
      const reading = h.readings[0];
      if (reading?.confirmedValue != null || reading?.ocrValue != null) {
        recordedCount++;
        if (reading.status === ReadingStatus.PENDING) pendingCount++;
        const csm = reading.confirmedValue ?? reading.ocrValue ?? 0;
        const usage = calculateUsage(csm, reading.oldReading);
        totalUsageM3 += usage;
        if (usage > 0) {
          totalAmount += calculateBillingAmounts(
            usage,
            h.priceGroup.unitPrice,
            vatPercent
          ).totalAmount;
        }
      }
    }
    summaries.push({
      routeId: "",
      routeName: "Chưa gán tuyến",
      routeCode: "none",
      householdCount: noRoute,
      recordedCount,
      pendingCount,
      totalUsageM3,
      totalAmount,
    });
  }

  return summaries;
}
