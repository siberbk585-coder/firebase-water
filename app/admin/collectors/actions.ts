"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/data/prisma";
import { collectorInternalPhone, hashPassword } from "@/lib/auth";
import { ensureFirebaseUser } from "@/lib/firebaseAuth";
import { requireAdmin } from "@/lib/guards";
import { logAudit } from "@/lib/audit";
import { isSandboxUsername } from "@/lib/sandboxRoutes";

function collectorsUrl(params?: { error?: string; created?: string }) {
  const q = new URLSearchParams();
  if (params?.error) q.set("error", params.error);
  if (params?.created) q.set("created", params.created);
  const s = q.toString();
  return `/admin/collectors${s ? `?${s}` : ""}`;
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function parseRouteIds(formData: FormData): string[] {
  return [...new Set(formData.getAll("routeIds").map((v) => String(v).trim()).filter(Boolean))];
}

export async function createCollector(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const routeIds = parseRouteIds(formData);

  if (!username || !name || password.length < 6) {
    redirect(collectorsUrl({ error: "Điền tên đăng nhập, họ tên và mật khẩu (tối thiểu 6 ký tự)." }));
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    redirect(
      collectorsUrl({
        error: "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.",
      })
    );
  }
  if (!routeIds.length) {
    redirect(collectorsUrl({ error: "Chọn ít nhất một khu vực thu." }));
  }

  const routes = await prisma.collectionRoute.findMany({
    where: { id: { in: routeIds } },
    select: { id: true },
  });
  if (routes.length !== routeIds.length) {
    redirect(collectorsUrl({ error: "Có khu vực không hợp lệ." }));
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { phone: collectorInternalPhone(username) }],
    },
    select: { id: true },
  });
  if (existing) {
    redirect(collectorsUrl({ error: `Tên đăng nhập "${username}" đã tồn tại.` }));
  }

  const passwordHash = await hashPassword(password);
  const phone = collectorInternalPhone(username);

  try {
    const { firebaseUid } = await ensureFirebaseUser({
      account: username,
      password,
      role: UserRole.COLLECTOR,
      name,
    });

    const user = await prisma.user.create({
      data: {
        phone,
        username,
        name,
        passwordHash,
        role: UserRole.COLLECTOR,
        firebaseUid,
        collectorRoutes: {
          create: routeIds.map((routeId) => ({ routeId })),
        },
      },
    });

    await logAudit({
      actorId: admin.id,
      action: "COLLECTOR_CREATED",
      entity: "User",
      entityId: user.id,
      metadata: { ten: name, username, khuVuc: routeIds.length },
    });

    revalidatePath("/admin/collectors");
    redirect(`/admin/collectors/${user.id}`);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(collectorsUrl({ error: "Tên đăng nhập đã tồn tại." }));
    }
    throw e;
  }
}

export async function updateCollectorRoutes(
  collectorId: string,
  formData: FormData
): Promise<void> {
  const admin = await requireAdmin();
  const routeIds = parseRouteIds(formData);

  const collector = await prisma.user.findUnique({
    where: { id: collectorId },
    select: { role: true, username: true, name: true },
  });
  if (!collector || collector.role !== UserRole.COLLECTOR) {
    redirect(collectorsUrl({ error: "Không tìm thấy tài khoản thu hộ." }));
  }
  if (!routeIds.length) {
    redirect(`/admin/collectors/${collectorId}?error=${encodeURIComponent("Chọn ít nhất một khu vực.")}`);
  }

  const routes = await prisma.collectionRoute.findMany({
    where: { id: { in: routeIds } },
    select: { id: true },
  });
  if (routes.length !== routeIds.length) {
    redirect(`/admin/collectors/${collectorId}?error=${encodeURIComponent("Có khu vực không hợp lệ.")}`);
  }

  await prisma.$transaction([
    prisma.collectorRoute.deleteMany({ where: { userId: collectorId } }),
    prisma.collectorRoute.createMany({
      data: routeIds.map((routeId) => ({ userId: collectorId, routeId })),
    }),
  ]);

  await logAudit({
    actorId: admin.id,
    action: "COLLECTOR_ROUTES_UPDATED",
    entity: "User",
    entityId: collectorId,
    metadata: { username: collector.username, khuVuc: routeIds.length },
  });

  revalidatePath("/admin/collectors");
  revalidatePath(`/admin/collectors/${collectorId}`);
}

export async function deactivateCollector(
  collectorId: string
): Promise<{ error: string } | void> {
  const admin = await requireAdmin();

  const collector = await prisma.user.findUnique({
    where: { id: collectorId },
    select: { role: true, username: true, name: true, isActive: true },
  });
  if (!collector || collector.role !== UserRole.COLLECTOR) {
    return { error: "Không tìm thấy tài khoản thu hộ." };
  }
  if (!collector.isActive) {
    return { error: "Tài khoản đã đóng." };
  }

  await prisma.user.update({
    where: { id: collectorId },
    data: { isActive: false },
  });

  await logAudit({
    actorId: admin.id,
    action: "COLLECTOR_DEACTIVATED",
    entity: "User",
    entityId: collectorId,
    metadata: { username: collector.username, ten: collector.name },
  });

  revalidatePath("/admin/collectors");
  revalidatePath(`/admin/collectors/${collectorId}`);
}

export async function resetCollectorPassword(
  collectorId: string,
  formData: FormData
): Promise<void> {
  const admin = await requireAdmin();
  const password = String(formData.get("password") ?? "").trim();
  const confirm = String(formData.get("passwordConfirm") ?? "").trim();

  if (password.length < 6) {
    redirect(
      `/admin/collectors/${collectorId}?error=${encodeURIComponent("Mật khẩu tối thiểu 6 ký tự.")}`
    );
  }
  if (password !== confirm) {
    redirect(
      `/admin/collectors/${collectorId}?error=${encodeURIComponent("Mật khẩu xác nhận không khớp.")}`
    );
  }

  const collector = await prisma.user.findUnique({
    where: { id: collectorId },
    select: { role: true, username: true, name: true },
  });
  if (!collector || collector.role !== UserRole.COLLECTOR) {
    redirect(collectorsUrl({ error: "Không tìm thấy tài khoản thu hộ." }));
  }
  if (!collector.username?.trim()) {
    redirect(
      `/admin/collectors/${collectorId}?error=${encodeURIComponent("Tài khoản thiếu tên đăng nhập.")}`
    );
  }
  if (isSandboxUsername(collector.username)) {
    redirect(
      `/admin/collectors/${collectorId}?error=${encodeURIComponent("Không đổi mật khẩu tài khoản sandbox.")}`
    );
  }

  const passwordHash = await hashPassword(password);
  await ensureFirebaseUser({
    account: collector.username,
    password,
    role: UserRole.COLLECTOR,
    name: collector.name,
  });

  await prisma.user.update({
    where: { id: collectorId },
    data: { passwordHash },
  });

  await logAudit({
    actorId: admin.id,
    action: "COLLECTOR_PASSWORD_RESET",
    entity: "User",
    entityId: collectorId,
    metadata: { username: collector.username },
  });

  revalidatePath("/admin/collectors");
  revalidatePath(`/admin/collectors/${collectorId}`);
  redirect(
    `/admin/collectors/${collectorId}?created=${encodeURIComponent("Đã đổi mật khẩu.")}`
  );
}

export async function reactivateCollector(
  collectorId: string
): Promise<{ error: string } | void> {
  const admin = await requireAdmin();

  const collector = await prisma.user.findUnique({
    where: { id: collectorId },
    select: { role: true, username: true, name: true, isActive: true },
  });
  if (!collector || collector.role !== UserRole.COLLECTOR) {
    return { error: "Không tìm thấy tài khoản thu hộ." };
  }
  if (collector.isActive) {
    return { error: "Tài khoản đang hoạt động." };
  }

  await prisma.user.update({
    where: { id: collectorId },
    data: { isActive: true },
  });

  await logAudit({
    actorId: admin.id,
    action: "COLLECTOR_REACTIVATED",
    entity: "User",
    entityId: collectorId,
    metadata: { username: collector.username, ten: collector.name },
  });

  revalidatePath("/admin/collectors");
  revalidatePath(`/admin/collectors/${collectorId}`);
}
