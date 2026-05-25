import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ReadingStatus, InvoiceStatus, UserRole } from "@/lib/types/enums";;

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const [households, pendingReadings, issuedInvoices, paidInvoices, ocrStats] =
    await Promise.all([
      prisma.household.count(),
      prisma.meterReading.count({ where: { status: ReadingStatus.PENDING } }),
      prisma.invoice.count({ where: { status: InvoiceStatus.ISSUED } }),
      prisma.invoice.count({ where: { status: InvoiceStatus.PAID } }),
      prisma.meterReading.findMany({
        where: { ocrValue: { not: null }, confirmedValue: { not: null } },
        select: { ocrValue: true, confirmedValue: true, confidence: true },
        take: 500,
      }),
    ]);

  const ocrMatch = ocrStats.filter((r) => r.ocrValue === r.confirmedValue).length;
  const avgConfidence =
    ocrStats.length > 0
      ? ocrStats.reduce((s, r) => s + (r.confidence ?? 0), 0) / ocrStats.length
      : 0;

  return NextResponse.json({
    households,
    pendingReadings,
    issuedInvoices,
    paidInvoices,
    ocrAccuracy: ocrStats.length ? (ocrMatch / ocrStats.length) * 100 : 0,
    avgConfidence,
  });
}
