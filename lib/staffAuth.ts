import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import {
  assertCollectorHouseholdAccess,
  assertCollectorInvoiceAccess,
  CollectorAccessError,
  isAdmin,
  isStaff,
} from "@/lib/collectorAccess";
import { prisma } from "@/lib/data/prisma";
import { UserRole } from "@/lib/types/enums";

export async function requireStaffSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session || !isStaff(session)) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isActive: true, role: true },
  });
  if (!user?.isActive) return null;
  return session;
}

export async function requireAdminSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session || !isAdmin(session)) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isActive: true },
  });
  if (!user?.isActive) return null;
  return session;
}

export function staffForbidden(message = "Không có quyền") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function staffUnauthorized(message = "Chưa đăng nhập") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export async function authorizeHouseholdAction(
  session: SessionUser,
  householdId: string
): Promise<NextResponse | null> {
  try {
    await assertCollectorHouseholdAccess(session, householdId);
    return null;
  } catch (e) {
    if (e instanceof CollectorAccessError) return staffForbidden(e.message);
    throw e;
  }
}

export async function authorizeInvoiceAction(
  session: SessionUser,
  invoiceId: string
): Promise<NextResponse | null> {
  try {
    await assertCollectorInvoiceAccess(session, invoiceId);
    return null;
  } catch (e) {
    if (e instanceof CollectorAccessError) return staffForbidden(e.message);
    throw e;
  }
}

export function isAdminOnlyRole(session: SessionUser): boolean {
  return session.role === UserRole.ADMIN;
}

export function revalidateStaffBillingPaths(): void {
  revalidatePath("/admin/billing-sheet");
  revalidatePath("/collector/billing-sheet");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/payments");
}
