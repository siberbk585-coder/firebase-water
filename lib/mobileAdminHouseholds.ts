import { Prisma, PaymentMethod, UserRole, InvoiceStatus, HouseholdStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/data/prisma";
import {
  currentCalendarPeriod,
  enrollHouseholdInOpenPeriods,
} from "@/lib/billingPeriods";
import { formatPeriod, householdInactiveFromLabel, householdStatusLabel } from "@/lib/vi";
import { logAudit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { MobileAdminError } from "@/lib/mobileAdminCollectors";
import { excludeSandboxHouseholdWhere } from "@/lib/sandboxRoutes";

export async function listHouseholdsForMobile(
  q: string | undefined,
  page: number,
  pageSize: number,
  filters?: { status?: HouseholdStatus; routeId?: string }
) {
  const and: Prisma.HouseholdWhereInput[] = [excludeSandboxHouseholdWhere()];

  if (q?.trim()) {
    and.push({
      OR: [
        { householdCode: { contains: q.trim(), mode: "insensitive" as const } },
        { meterCode: { contains: q.trim(), mode: "insensitive" as const } },
        { residentName: { contains: q.trim(), mode: "insensitive" as const } },
        { address: { contains: q.trim(), mode: "insensitive" as const } },
      ],
    });
  }

  if (filters?.status) {
    and.push({ status: filters.status });
  }

  if (filters?.routeId) {
    and.push({ collectionRouteId: filters.routeId });
  }

  const where = and.length ? { AND: and } : undefined;

  const skip = (page - 1) * pageSize;

  const [households, total] = await Promise.all([
    prisma.household.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { householdCode: "asc" },
      include: {
        collectionRoute: { select: { name: true } },
      },
    }),
    prisma.household.count({ where }),
  ]);

  return {
    households: households.map((h) => ({
      id: h.id,
      householdCode: h.householdCode,
      meterCode: h.meterCode,
      residentName: h.residentName,
      address: h.address,
      status: h.status,
      statusLabel: householdStatusLabel(h.status),
      inactiveFromLabel: householdInactiveFromLabel(h.inactiveFromYear, h.inactiveFromMonth),
      routeName: h.collectionRoute?.name ?? null,
      contactPhone: h.contactPhone,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getHouseholdForMobile(id: string) {
  const household = await prisma.household.findUnique({
    where: { id },
    include: {
      collectionRoute: { select: { name: true, unitPrice: true } },
      user: { select: { phone: true } },
    },
  });
  if (!household) {
    throw new MobileAdminError("Không tìm thấy hộ.", 404);
  }

  const inactiveFromLabel = householdInactiveFromLabel(
    household.inactiveFromYear,
    household.inactiveFromMonth
  );

  return {
    id: household.id,
    householdCode: household.householdCode,
    meterCode: household.meterCode,
    residentName: household.residentName,
    address: household.address,
    contactPhone: household.contactPhone ?? household.user?.phone,
    status: household.status,
    statusLabel: householdStatusLabel(household.status),
    inactiveFromLabel,
    paymentMethod: household.paymentMethod,
    routeName: household.collectionRoute?.name ?? null,
    unitPrice: household.collectionRoute?.unitPrice ?? null,
    appPhone: household.user?.phone ?? null,
    note: household.note,
    createdAt: household.createdAt.toISOString(),
  };
}

export async function createHouseholdForMobile(
  admin: SessionUser,
  input: {
    householdCode: string;
    meterCode: string;
    residentName: string;
    address: string;
    collectionRouteId: string;
    contactPhone?: string;
    appPhone?: string;
    appPassword?: string;
  }
) {
  const householdCode = input.householdCode.trim().toUpperCase();
  const meterCode = input.meterCode.trim().toUpperCase();
  const residentName = input.residentName.trim();
  const address = input.address.trim();
  const collectionRouteId = input.collectionRouteId.trim();
  const contactPhone = input.contactPhone?.trim() ?? "";
  const appPhone = input.appPhone?.trim() ?? "";
  const appPassword = input.appPassword?.trim() ?? "";

  if (!householdCode || !meterCode || !residentName || !address || !collectionRouteId) {
    throw new MobileAdminError(
      "Điền đủ mã hộ, mã đồng hồ, tên chủ hộ, địa chỉ và khu vực."
    );
  }

  const route = await prisma.collectionRoute.findUnique({ where: { id: collectionRouteId } });
  if (!route) {
    throw new MobileAdminError("Khu vực không hợp lệ.");
  }

  const maxSortOrder = await prisma.household.aggregate({
    where: { collectionRouteId },
    _max: { routeSortOrder: true },
  });
  const nextSortOrder = (maxSortOrder._max.routeSortOrder ?? 0) + 1;

  const priceGroup = await prisma.priceGroup.findFirst({ orderBy: { code: "asc" } });
  if (!priceGroup) {
    throw new MobileAdminError("Chưa có nhóm giá mặc định trong hệ thống.");
  }

  let userId: string | undefined;
  if (appPhone) {
    const existingUser = await prisma.user.findUnique({
      where: { phone: appPhone },
      include: { household: { select: { householdCode: true } } },
    });
    if (existingUser?.household) {
      throw new MobileAdminError(
        `SĐT ${appPhone} đã gắn hộ ${existingUser.household.householdCode}.`
      );
    }
    const passwordHash = await bcrypt.hash(
      appPassword.length >= 6 ? appPassword : "123456",
      10
    );
    if (existingUser) {
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { name: residentName, passwordHash, role: UserRole.RESIDENT },
      });
      userId = user.id;
    } else {
      const user = await prisma.user.create({
        data: {
          phone: appPhone,
          passwordHash,
          name: residentName,
          role: UserRole.RESIDENT,
        },
      });
      userId = user.id;
    }
  }

  try {
    const household = await prisma.household.create({
      data: {
        householdCode,
        meterCode,
        residentName,
        address,
        contactPhone: contactPhone || appPhone || null,
        priceGroupId: priceGroup.id,
        collectionRouteId,
        routeSortOrder: nextSortOrder,
        userId,
        status: HouseholdStatus.ACTIVE,
        inactiveFromYear: null,
        inactiveFromMonth: null,
      },
    });

    await enrollHouseholdInOpenPeriods(household.id);

    await logAudit({
      actorId: admin.id,
      action: "HOUSEHOLD_CREATED",
      entity: "Household",
      entityId: household.id,
      metadata: { tenHo: residentName, maHo: householdCode, mkh: meterCode, source: "MOBILE" },
    });

    return {
      id: household.id,
      status: household.status,
      statusLabel: householdStatusLabel(household.status),
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new MobileAdminError(
        "Mã hộ hoặc mã đồng hồ (hoặc tài khoản) đã tồn tại."
      );
    }
    throw e;
  }
}

export async function updateHouseholdPaymentMethodForMobile(
  admin: SessionUser,
  householdId: string,
  paymentMethod: string
) {
  if (paymentMethod !== PaymentMethod.CASH && paymentMethod !== PaymentMethod.BANK_TRANSFER) {
    throw new MobileAdminError("Hình thức thu không hợp lệ.");
  }
  await prisma.household.update({
    where: { id: householdId },
    data: { paymentMethod },
  });
  await logAudit({
    actorId: admin.id,
    action: "HOUSEHOLD_PAYMENT_METHOD_UPDATED",
    entity: "Household",
    entityId: householdId,
    metadata: { hinhThuc: paymentMethod, source: "MOBILE" },
  });
}

export async function deactivateHouseholdForMobile(admin: SessionUser, householdId: string) {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: {
      householdCode: true,
      meterCode: true,
      residentName: true,
      status: true,
    },
  });
  if (!household) {
    throw new MobileAdminError("Không tìm thấy hộ.", 404);
  }
  if (household.status === HouseholdStatus.INACTIVE) {
    throw new MobileAdminError("Hộ đã ngưng sử dụng.");
  }

  const { year, month } = currentCalendarPeriod();
  await prisma.household.update({
    where: { id: householdId },
    data: {
      status: HouseholdStatus.INACTIVE,
      inactiveFromYear: year,
      inactiveFromMonth: month,
    },
  });

  await logAudit({
    actorId: admin.id,
    action: "HOUSEHOLD_DEACTIVATED",
    entity: "Household",
    entityId: householdId,
    metadata: {
      tenHo: household.residentName,
      maHo: household.householdCode,
      mkh: household.meterCode,
      kyCuoi: formatPeriod(month, year),
      source: "MOBILE",
    },
  });
}

export async function reactivateHouseholdForMobile(admin: SessionUser, householdId: string) {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: {
      householdCode: true,
      meterCode: true,
      residentName: true,
      status: true,
    },
  });
  if (!household) {
    throw new MobileAdminError("Không tìm thấy hộ.", 404);
  }
  if (household.status === HouseholdStatus.ACTIVE) {
    throw new MobileAdminError("Hộ đang sử dụng bình thường.");
  }

  await prisma.household.update({
    where: { id: householdId },
    data: {
      status: HouseholdStatus.ACTIVE,
      inactiveFromYear: null,
      inactiveFromMonth: null,
    },
  });

  await enrollHouseholdInOpenPeriods(householdId);

  await logAudit({
    actorId: admin.id,
    action: "HOUSEHOLD_REACTIVATED",
    entity: "Household",
    entityId: householdId,
    metadata: {
      tenHo: household.residentName,
      maHo: household.householdCode,
      mkh: household.meterCode,
      source: "MOBILE",
    },
  });
}

export async function deleteHouseholdForMobile(admin: SessionUser, householdId: string) {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: {
      householdCode: true,
      meterCode: true,
      residentName: true,
    },
  });
  if (!household) {
    throw new MobileAdminError("Không tìm thấy hộ.", 404);
  }

  const paidCount = await prisma.invoice.count({
    where: { householdId, status: InvoiceStatus.PAID },
  });
  if (paidCount > 0) {
    throw new MobileAdminError(
      `Không thể xóa — hộ này có ${paidCount} hóa đơn đã thu tiền.`
    );
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { householdId } }),
    prisma.invoiceSendLog.deleteMany({ where: { invoice: { householdId } } }),
    prisma.payment.deleteMany({ where: { invoice: { householdId } } }),
    prisma.invoice.deleteMany({ where: { householdId } }),
    prisma.meterReading.deleteMany({ where: { householdId } }),
    prisma.household.delete({ where: { id: householdId } }),
  ]);

  await logAudit({
    actorId: admin.id,
    action: "HOUSEHOLD_DELETED",
    entity: "Household",
    entityId: householdId,
    metadata: {
      tenHo: household.residentName,
      maHo: household.householdCode,
      mkh: household.meterCode,
      source: "MOBILE",
    },
  });
}
