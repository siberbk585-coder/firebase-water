import { prisma } from "@/lib/data/prisma";
import { getSystemSettings, updateSystemSettings } from "@/lib/settings";
import {
  calculateBillingAmounts,
  normalizeVatPercent,
  unitPriceExclusiveFromInclusive,
} from "@/lib/vat";
import type { SessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { MobileAdminError } from "@/lib/mobileAdminCollectors";
import { excludeSandboxRoutesWhere } from "@/lib/sandboxRoutes";

export async function getPricingForMobile() {
  const [routes, settings] = await Promise.all([
    prisma.collectionRoute.findMany({
      where: excludeSandboxRoutesWhere(),
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { households: true } } },
    }),
    getSystemSettings(),
  ]);

  const defaultPrice =
    routes.find((r) => r.unitPrice != null)?.unitPrice ??
    (await prisma.priceGroup.findFirst({ orderBy: { code: "asc" } }))?.unitPrice ??
    15000;

  const vatPercent = settings.vatPercent;
  const vatSample = calculateBillingAmounts(10, defaultPrice, vatPercent);
  const unitOnReceipt = unitPriceExclusiveFromInclusive(defaultPrice, vatPercent);

  return {
    vatPercent,
    defaultUnitPrice: defaultPrice,
    vatSample: {
      usageM3: 10,
      totalAmount: vatSample.totalAmount,
      subtotalAmount: vatSample.subtotal,
      vatAmount: vatSample.vatAmount,
      unitPriceOnReceipt: Math.round(unitOnReceipt),
    },
    routes: routes.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      sortOrder: r.sortOrder,
      unitPrice: r.unitPrice ?? defaultPrice,
      householdCount: r._count.households,
    })),
  };
}

export async function saveVatForMobile(admin: SessionUser, vatPercentRaw: number) {
  const vatPercent = normalizeVatPercent(vatPercentRaw);
  await updateSystemSettings({ vatPercent });
  await logAudit({
    actorId: admin.id,
    action: "VAT_UPDATED",
    entity: "SystemSettings",
    entityId: "default",
    metadata: { vatPercent, source: "MOBILE" },
  });
  return { vatPercent };
}

export async function saveRoutePricesForMobile(
  admin: SessionUser,
  prices: { routeId: string; unitPrice: number }[]
) {
  if (!prices.length) {
    throw new MobileAdminError("Không có giá để lưu.");
  }

  const routeIds = await prisma.collectionRoute.findMany({
    where: excludeSandboxRoutesWhere(),
    select: { id: true },
  });
  const valid = new Set(routeIds.map((r) => r.id));

  for (const row of prices) {
    if (!valid.has(row.routeId)) {
      throw new MobileAdminError("Có khu vực không hợp lệ.");
    }
    if (row.unitPrice < 0 || !Number.isFinite(row.unitPrice)) {
      throw new MobileAdminError("Giá không hợp lệ.");
    }
    await prisma.collectionRoute.update({
      where: { id: row.routeId },
      data: { unitPrice: Math.round(row.unitPrice) },
    });
  }

  await logAudit({
    actorId: admin.id,
    action: "ROUTE_PRICES_UPDATED",
    entity: "CollectionRoute",
    metadata: { count: prices.length, source: "MOBILE" },
  });
}

export async function createRouteForMobile(
  admin: SessionUser,
  input: { code: string; name: string; sortOrder: number; unitPrice: number }
) {
  const code = input.code.trim();
  const name = input.name.trim();
  if (!code || !name) {
    throw new MobileAdminError("Nhập mã và tên khu vực.");
  }
  const unitPrice = Math.round(input.unitPrice);
  if (unitPrice < 0) {
    throw new MobileAdminError("Giá không hợp lệ.");
  }

  const route = await prisma.collectionRoute.create({
    data: {
      code,
      name,
      sortOrder: input.sortOrder,
      unitPrice,
    },
  });

  await logAudit({
    actorId: admin.id,
    action: "ROUTE_CREATED",
    entity: "CollectionRoute",
    entityId: route.id,
    metadata: { code, name, source: "MOBILE" },
  });

  return { id: route.id };
}
