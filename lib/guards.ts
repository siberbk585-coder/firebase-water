import { redirect } from "next/navigation";
import { UserRole } from "@/lib/types/enums";
import { getSession, type SessionUser } from "./auth";
import { prisma } from "@/lib/data/prisma";

async function ensureActiveUser(session: SessionUser): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isActive: true },
  });
  if (!user?.isActive) return null;
  return session;
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  const active = await ensureActiveUser(session);
  if (!active) redirect("/login");
  return active;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== UserRole.ADMIN) {
    if (session.role === UserRole.COLLECTOR) redirect("/collector/billing-sheet");
    redirect("/resident/submit-reading");
  }
  return session;
}

export async function requireCollector(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== UserRole.COLLECTOR) {
    if (session.role === UserRole.ADMIN) redirect("/admin/dashboard");
    redirect("/resident/submit-reading");
  }
  return session;
}

export async function requireResident(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== UserRole.RESIDENT) {
    if (session.role === UserRole.ADMIN) redirect("/admin/billing-sheet?route=all");
    if (session.role === UserRole.COLLECTOR) redirect("/collector/billing-sheet");
  }
  return session;
}

export async function requireStaff(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.COLLECTOR) {
    redirect("/resident/submit-reading");
  }
  return session;
}
