import { redirect } from "next/navigation";
import { UserRole } from "@/lib/types/enums";
import { getSession, type SessionUser } from "./auth";

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== UserRole.ADMIN) redirect("/resident/submit-reading");
  return session;
}

export async function requireResident(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== UserRole.RESIDENT) redirect("/admin/billing-sheet?route=all");
  return session;
}
