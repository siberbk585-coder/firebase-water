import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/data/prisma";
import { collectorInternalPhone, hashPassword } from "@/lib/auth";
import { ensureFirebaseUser } from "@/lib/firebaseAuth";
import { logAudit } from "@/lib/audit";
import { UserRole } from "@/lib/types/enums";
import type { SessionUser } from "@/lib/auth";
import {
  excludeSandboxCollectorsWhere,
  excludeSandboxRoutesWhere,
} from "@/lib/sandboxRoutes";

export class MobileAdminError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "MobileAdminError";
  }
}

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function listCollectorsForMobile() {
  const collectors = await prisma.user.findMany({
    where: { role: UserRole.COLLECTOR, ...excludeSandboxCollectorsWhere() },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      collectorRoutes: {
        include: { route: { select: { id: true, name: true, code: true } } },
      },
    },
  });

  return collectors.map((c) => ({
    id: c.id,
    username: c.username,
    name: c.name,
    isActive: c.isActive,
    routes: c.collectorRoutes.map((cr) => ({
      id: cr.route.id,
      code: cr.route.code,
      name: cr.route.name,
    })),
  }));
}

export async function getCollectorForMobile(id: string) {
  const collector = await prisma.user.findUnique({
    where: { id },
    include: {
      collectorRoutes: { select: { routeId: true } },
    },
  });
  if (!collector || collector.role !== UserRole.COLLECTOR) {
    throw new MobileAdminError("Không tìm thấy tài khoản thu hộ.", 404);
  }

  const routes = await prisma.collectionRoute.findMany({
    where: excludeSandboxRoutesWhere(),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, code: true },
  });

  return {
    id: collector.id,
    username: collector.username,
    name: collector.name,
    isActive: collector.isActive,
    assignedRouteIds: collector.collectorRoutes.map((r) => r.routeId),
    allRoutes: routes,
  };
}

export async function createCollectorForMobile(
  admin: SessionUser,
  input: { username: string; name: string; password: string; routeIds: string[] }
) {
  const username = normalizeUsername(input.username);
  const name = input.name.trim();
  const password = input.password.trim();
  const routeIds = [...new Set(input.routeIds.map((id) => id.trim()).filter(Boolean))];

  if (!username || !name || password.length < 6) {
    throw new MobileAdminError(
      "Điền tên đăng nhập, họ tên và mật khẩu (tối thiểu 6 ký tự)."
    );
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new MobileAdminError(
      "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang."
    );
  }
  if (!routeIds.length) {
    throw new MobileAdminError("Chọn ít nhất một khu vực thu.");
  }

  const routes = await prisma.collectionRoute.findMany({
    where: { id: { in: routeIds } },
    select: { id: true },
  });
  if (routes.length !== routeIds.length) {
    throw new MobileAdminError("Có khu vực không hợp lệ.");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { phone: collectorInternalPhone(username) }],
    },
    select: { id: true },
  });
  if (existing) {
    throw new MobileAdminError(`Tên đăng nhập "${username}" đã tồn tại.`);
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
      metadata: { ten: name, username, khuVuc: routeIds.length, source: "MOBILE" },
    });

    return { id: user.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new MobileAdminError("Tên đăng nhập đã tồn tại.");
    }
    throw e;
  }
}

export async function updateCollectorRoutesForMobile(
  admin: SessionUser,
  collectorId: string,
  routeIds: string[]
) {
  const uniqueRouteIds = [...new Set(routeIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueRouteIds.length) {
    throw new MobileAdminError("Chọn ít nhất một khu vực.");
  }

  const collector = await prisma.user.findUnique({
    where: { id: collectorId },
    select: { role: true, username: true, name: true },
  });
  if (!collector || collector.role !== UserRole.COLLECTOR) {
    throw new MobileAdminError("Không tìm thấy tài khoản thu hộ.", 404);
  }

  const routes = await prisma.collectionRoute.findMany({
    where: { id: { in: uniqueRouteIds } },
    select: { id: true },
  });
  if (routes.length !== uniqueRouteIds.length) {
    throw new MobileAdminError("Có khu vực không hợp lệ.");
  }

  await prisma.$transaction([
    prisma.collectorRoute.deleteMany({ where: { userId: collectorId } }),
    prisma.collectorRoute.createMany({
      data: uniqueRouteIds.map((routeId) => ({ userId: collectorId, routeId })),
    }),
  ]);

  await logAudit({
    actorId: admin.id,
    action: "COLLECTOR_ROUTES_UPDATED",
    entity: "User",
    entityId: collectorId,
    metadata: { username: collector.username, khuVuc: uniqueRouteIds.length, source: "MOBILE" },
  });
}

export async function setCollectorActiveForMobile(
  admin: SessionUser,
  collectorId: string,
  active: boolean
) {
  const collector = await prisma.user.findUnique({
    where: { id: collectorId },
    select: { role: true, username: true, name: true, isActive: true },
  });
  if (!collector || collector.role !== UserRole.COLLECTOR) {
    throw new MobileAdminError("Không tìm thấy tài khoản thu hộ.", 404);
  }

  if (active && collector.isActive) {
    throw new MobileAdminError("Tài khoản đang hoạt động.");
  }
  if (!active && !collector.isActive) {
    throw new MobileAdminError("Tài khoản đã đóng.");
  }

  await prisma.user.update({
    where: { id: collectorId },
    data: { isActive: active },
  });

  await logAudit({
    actorId: admin.id,
    action: active ? "COLLECTOR_REACTIVATED" : "COLLECTOR_DEACTIVATED",
    entity: "User",
    entityId: collectorId,
    metadata: { username: collector.username, ten: collector.name, source: "MOBILE" },
  });
}
