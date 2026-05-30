"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, PaymentMethod, UserRole, InvoiceStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { enrollHouseholdInOpenPeriods } from "@/lib/billingPeriods";
import { requireAdmin } from "@/lib/guards";
import { logAudit } from "@/lib/audit";

function householdsListUrl(params?: { error?: string; created?: string }) {
  const q = new URLSearchParams();
  if (params?.error) q.set("error", params.error);
  if (params?.created) q.set("created", params.created);
  const s = q.toString();
  return `/admin/households${s ? `?${s}` : ""}`;
}

export async function createHousehold(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const householdCode = String(formData.get("householdCode") ?? "")
    .trim()
    .toUpperCase();
  const meterCode = String(formData.get("meterCode") ?? "")
    .trim()
    .toUpperCase();
  const residentName = String(formData.get("residentName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const collectionRouteId = String(formData.get("collectionRouteId") ?? "").trim();
  const appPhone = String(formData.get("appPhone") ?? "").trim();
  const appPassword = String(formData.get("appPassword") ?? "").trim();

  if (!householdCode || !meterCode || !residentName || !address || !collectionRouteId) {
    redirect(
      householdsListUrl({
        error: "Điền đủ mã hộ, mã đồng hồ, tên chủ hộ, địa chỉ và khu vực.",
      })
    );
  }

  const route = await prisma.collectionRoute.findUnique({ where: { id: collectionRouteId } });
  if (!route) {
    redirect(householdsListUrl({ error: "Khu vực không hợp lệ." }));
  }

  const maxSortOrder = await prisma.household.aggregate({
    where: { collectionRouteId },
    _max: { routeSortOrder: true },
  });
  const nextSortOrder = (maxSortOrder._max.routeSortOrder ?? 0) + 1;

  const priceGroup = await prisma.priceGroup.findFirst({ orderBy: { code: "asc" } });
  if (!priceGroup) {
    redirect(householdsListUrl({ error: "Chưa có nhóm giá mặc định trong hệ thống." }));
  }
  const priceGroupId = priceGroup.id;

  let userId: string | undefined;
  if (appPhone) {
    const existingUser = await prisma.user.findUnique({
      where: { phone: appPhone },
      include: { household: { select: { householdCode: true } } },
    });
    if (existingUser?.household) {
      redirect(
        householdsListUrl({
          error: `SĐT ${appPhone} đã gắn hộ ${existingUser.household.householdCode}.`,
        })
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
        priceGroupId,
        collectionRouteId,
        routeSortOrder: nextSortOrder,
        userId,
      },
    });

    await enrollHouseholdInOpenPeriods(household.id);

    await logAudit({
      actorId: admin.id,
      action: "HOUSEHOLD_CREATED",
      entity: "Household",
      entityId: household.id,
      metadata: { tenHo: residentName, maHo: householdCode, mkh: meterCode },
    });

    revalidatePath("/admin/households");
    revalidatePath("/admin/billing-sheet");
    revalidatePath("/admin/routes");

    redirect(`/admin/households/${household.id}`);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(
        householdsListUrl({
          error: "Mã hộ hoặc mã đồng hồ (hoặc tài khoản) đã tồn tại.",
        })
      );
    }
    throw e;
  }
}

export async function updateHouseholdPaymentMethod(
  householdId: string,
  formData: FormData
): Promise<void> {
  const admin = await requireAdmin();
  const raw = String(formData.get("paymentMethod") ?? "").trim();
  if (raw !== PaymentMethod.CASH && raw !== PaymentMethod.BANK_TRANSFER) {
    return;
  }
  await prisma.household.update({
    where: { id: householdId },
    data: { paymentMethod: raw },
  });
  await logAudit({
    actorId: admin.id,
    action: "HOUSEHOLD_PAYMENT_METHOD_UPDATED",
    entity: "Household",
    entityId: householdId,
    metadata: { hinhThuc: raw },
  });
  revalidatePath(`/admin/households/${householdId}`);
  revalidatePath("/admin/payments");
}

export async function deleteHousehold(
  householdId: string
): Promise<{ error: string } | void> {
  const admin = await requireAdmin();

  const household = await prisma.household.findUniqueOrThrow({
    where: { id: householdId },
    select: {
      householdCode: true,
      meterCode: true,
      residentName: true,
      userId: true,
    },
  });

  const paidCount = await prisma.invoice.count({
    where: { householdId, status: InvoiceStatus.PAID },
  });
  if (paidCount > 0) {
    return {
      error: `Không thể xóa — hộ này có ${paidCount} hóa đơn đã thu tiền. Liên hệ quản trị viên để xử lý.`,
    };
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
    },
  });

  revalidatePath("/admin/households");
  revalidatePath("/admin/billing-sheet");
  redirect("/admin/households");
}
