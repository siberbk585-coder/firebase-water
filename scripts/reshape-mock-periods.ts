/**
 * Chỉnh mock theo kỳ: T3 + T4 chốt + thu 100% (kỳ CLOSED), T5 giữ nguyên.
 *
 *   npm run db:reshape-mock-periods
 *   MOCK_YEAR=2026 npm run db:reshape-mock-periods
 */
import {
  ReadingStatus,
  InvoiceStatus,
  PeriodStatus,
  HouseholdStatus,
  InputMethod,
  UserRole,
} from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";
import { unitPriceForHousehold } from "../lib/routePricing";
import { calculateBillingAmounts } from "../lib/vat";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";

assertDestructiveAllowed("db:reshape-mock-periods");

const YEAR = Number(process.env.MOCK_YEAR ?? new Date().getFullYear());
const MARCH = 3;
const APRIL = 4;
const MAY = 5;
type Hh = {
  id: string;
  householdCode: string;
  priceGroup: { unitPrice: number };
  collectionRoute: { unitPrice: number | null } | null;
};

async function ensurePeriod(
  prisma: PrismaClient,
  year: number,
  month: number,
  status: PeriodStatus
) {
  return prisma.billingPeriod.upsert({
    where: { year_month: { year, month } },
    create: { year, month, status },
    update: { status },
  });
}

async function prevConfirmed(
  prisma: PrismaClient,
  householdId: string,
  beforeYear: number,
  beforeMonth: number
): Promise<number> {
  const prev = await prisma.meterReading.findFirst({
    where: {
      householdId,
      period: {
        OR: [
          { year: { lt: beforeYear } },
          { year: beforeYear, month: { lt: beforeMonth } },
        ],
      },
      confirmedValue: { not: null },
    },
    orderBy: [{ period: { year: "desc" } }, { period: { month: "desc" } }],
    select: { confirmedValue: true },
  });
  return prev?.confirmedValue ?? 120 + (householdId.charCodeAt(0) % 40);
}

async function upsertConfirmedReading(
  prisma: PrismaClient,
  householdId: string,
  periodId: string,
  year: number,
  month: number,
  usageM3: number,
  oldReading: number
) {
  const confirmed = oldReading + usageM3;
  await prisma.meterReading.upsert({
    where: { householdId_periodId: { householdId, periodId } },
    create: {
      householdId,
      periodId,
      oldReading,
      confirmedValue: confirmed,
      usageM3,
      inputMethod: InputMethod.MANUAL,
      status: ReadingStatus.CONFIRMED,
      confirmedAt: new Date(year, month - 1, 15),
      anomalyFlags: "[]",
    },
    update: {
      oldReading,
      confirmedValue: confirmed,
      usageM3,
      status: ReadingStatus.CONFIRMED,
      ocrValue: null,
      confirmedAt: new Date(year, month - 1, 15),
      anomalyFlags: "[]",
    },
  });
  return confirmed;
}

async function upsertInvoice(
  prisma: PrismaClient,
  household: Hh,
  periodId: string,
  usageM3: number,
  status: InvoiceStatus
) {
  const unitPrice = unitPriceForHousehold(household);
  const amounts = calculateBillingAmounts(usageM3, unitPrice, 10);
  const invoice = await prisma.invoice.upsert({
    where: { householdId_periodId: { householdId: household.id, periodId } },
    create: {
      householdId: household.id,
      periodId,
      usageM3,
      unitPrice,
      subtotalAmount: amounts.subtotal,
      vatPercent: amounts.vatPercent,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      status,
      issuedAt: status !== InvoiceStatus.DRAFT ? new Date() : null,
    },
    update: {
      usageM3,
      unitPrice,
      subtotalAmount: amounts.subtotal,
      vatPercent: amounts.vatPercent,
      vatAmount: amounts.vatAmount,
      totalAmount: amounts.totalAmount,
      status,
      issuedAt: new Date(),
    },
  });

  if (status === InvoiceStatus.PAID) {
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    await prisma.payment.upsert({
      where: { invoiceId: invoice.id },
      create: {
        invoiceId: invoice.id,
        amount: amounts.totalAmount,
        method: "BANK_TRANSFER",
        note: "Mock reshape",
        confirmedAt: new Date(),
        confirmedById: admin?.id,
      },
      update: { amount: amounts.totalAmount, confirmedAt: new Date() },
    });
  } else {
    await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
  }
  return invoice;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("firebase_water")) {
    delete process.env.DATABASE_URL;
  }

  const prisma = await createPrismaTiennuoc();
  try {
    const march = await ensurePeriod(prisma, YEAR, MARCH, PeriodStatus.CLOSED);
    const april = await ensurePeriod(prisma, YEAR, APRIL, PeriodStatus.CLOSED);
    const may = await ensurePeriod(prisma, YEAR, MAY, PeriodStatus.OPEN);

    const households = await prisma.household.findMany({
      where: { status: HouseholdStatus.ACTIVE },
      orderBy: { householdCode: "asc" },
      include: {
        priceGroup: true,
        collectionRoute: { select: { unitPrice: true } },
      },
    });

    let marchPaid = 0;
    let aprilPaid = 0;

    for (let idx = 0; idx < households.length; idx++) {
      const h = households[idx]!;
      const usageBase = 9 + (idx % 6);

      const oldMar = await prevConfirmed(prisma, h.id, YEAR, MARCH);
      const confirmedMar = await upsertConfirmedReading(
        prisma,
        h.id,
        march.id,
        YEAR,
        MARCH,
        usageBase,
        oldMar
      );
      await upsertInvoice(prisma, h, march.id, usageBase, InvoiceStatus.PAID);
      marchPaid++;

      const usageApr = usageBase + (idx % 3);
      await upsertConfirmedReading(
        prisma,
        h.id,
        april.id,
        YEAR,
        APRIL,
        usageApr,
        confirmedMar
      );
      await upsertInvoice(prisma, h, april.id, usageApr, InvoiceStatus.PAID);
      aprilPaid++;
    }

    console.log(`Kỳ mock ${YEAR}:`);
    console.log(
      `  Tháng ${MARCH}: CLOSED — ${marchPaid}/${households.length} hộ chốt + PAID 100%`
    );
    console.log(
      `  Tháng ${APRIL}: CLOSED — ${aprilPaid}/${households.length} hộ chốt + PAID 100%`
    );
    console.log(`  Tháng ${MAY}: giữ nguyên (id ${may.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
