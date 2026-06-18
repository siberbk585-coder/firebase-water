import { prisma } from "@/lib/data/prisma";
import { UserRole } from "@/lib/types/enums";
import type { SessionUser } from "@/lib/auth";

export class CollectorAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectorAccessError";
  }
}

export function isAdmin(session: SessionUser): boolean {
  return session.role === UserRole.ADMIN;
}

export function isCollector(session: SessionUser): boolean {
  return session.role === UserRole.COLLECTOR;
}

export function isStaff(session: SessionUser): boolean {
  return isAdmin(session) || isCollector(session);
}

export async function getCollectorRouteIds(userId: string): Promise<string[]> {
  const rows = await prisma.collectorRoute.findMany({
    where: { userId },
    select: { routeId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.routeId);
}

export async function assertCollectorRouteAccess(
  session: SessionUser,
  routeId: string | null | undefined
): Promise<void> {
  if (isAdmin(session)) return;
  if (!isCollector(session)) {
    throw new CollectorAccessError("Không có quyền");
  }
  if (!routeId) {
    throw new CollectorAccessError("Chưa chọn khu vực thu");
  }
  const allowed = await getCollectorRouteIds(session.id);
  if (!allowed.includes(routeId)) {
    throw new CollectorAccessError("Không có quyền trên khu vực này");
  }
}

export async function assertCollectorHouseholdAccess(
  session: SessionUser,
  householdId: string
): Promise<void> {
  if (isAdmin(session)) return;
  if (!isCollector(session)) {
    throw new CollectorAccessError("Không có quyền");
  }
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    select: { collectionRouteId: true },
  });
  if (!household?.collectionRouteId) {
    throw new CollectorAccessError("Hộ không thuộc khu vực được gán");
  }
  await assertCollectorRouteAccess(session, household.collectionRouteId);
}

export async function assertCollectorInvoiceAccess(
  session: SessionUser,
  invoiceId: string
): Promise<void> {
  if (isAdmin(session)) return;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { householdId: true },
  });
  if (!invoice) throw new CollectorAccessError("Không tìm thấy hóa đơn");
  await assertCollectorHouseholdAccess(session, invoice.householdId);
}

export function filterRoutesForSession<T extends { id: string }>(
  session: SessionUser,
  routes: T[],
  allowedRouteIds: string[]
): T[] {
  if (isAdmin(session)) return routes;
  const allowed = new Set(allowedRouteIds);
  return routes.filter((r) => allowed.has(r.id));
}

export function resolveCollectorRouteQuery(
  session: SessionUser,
  routeQuery: string | undefined,
  allowedRouteIds: string[]
): string | null {
  if (isAdmin(session)) {
    if (!routeQuery || routeQuery === "all" || routeQuery === "summary") return null;
    return routeQuery;
  }
  if (!allowedRouteIds.length) return "__none__";
  if (!routeQuery || routeQuery === "all" || routeQuery === "summary") {
    return allowedRouteIds.length === 1 ? allowedRouteIds[0]! : null;
  }
  if (!allowedRouteIds.includes(routeQuery)) return "__denied__";
  return routeQuery;
}
