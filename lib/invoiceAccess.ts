import type { UserRole } from "@/lib/types/enums";
import { prisma } from "./db";

export async function getInvoiceForViewer(invoiceId: string, session: {
  role: UserRole;
  householdId?: string | null;
}) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { household: true, period: true },
  });
  if (!invoice?.pdfPath) return null;

  if (session.role === "ADMIN" || invoice.householdId === session.householdId) {
    return { ...invoice, pdfPath: invoice.pdfPath };
  }
  return null;
}
