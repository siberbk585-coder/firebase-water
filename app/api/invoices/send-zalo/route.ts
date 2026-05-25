import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { InvoiceStatus, UserRole } from "@/lib/types/enums";;
import { prisma } from "@/lib/db";
import { buildTransferNote } from "@/lib/paymentQr";
import { sendInvoiceViaN8n, periodLabelFromParts } from "@/lib/n8nInvoice";
import { isExternalPdfUrl } from "@/lib/invoicePdf";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ periodId: z.string() });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      periodId: parsed.data.periodId,
      status: InvoiceStatus.ISSUED,
      zaloSentAt: null,
    },
    include: { household: true, period: true },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const inv of invoices) {
    if (!inv.pdfPath) {
      errors.push(`${inv.household.householdCode}: chưa có link PDF`);
      continue;
    }
    try {
      const result = await sendInvoiceViaN8n({
        invoiceId: inv.id,
        householdCode: inv.household.householdCode,
        meterCode: inv.household.meterCode,
        periodMonth: inv.period.month,
        periodYear: inv.period.year,
        residentName: inv.household.residentName,
        contactPhone: inv.household.contactPhone,
        periodLabel: periodLabelFromParts(inv.period.month, inv.period.year),
        totalAmount: inv.totalAmount,
        usageM3: inv.usageM3,
        transferNote: buildTransferNote(inv.household.meterCode, inv.period.month, inv.period.year),
        pdfUrl: isExternalPdfUrl(inv.pdfPath)
          ? inv.pdfPath
          : undefined,
      });

      if (result.skipped) {
        skipped++;
        continue;
      }

      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          zaloSentAt: new Date(),
          zaloMessageId: result.messageId ?? null,
        },
      });
      sent++;
    } catch (e) {
      errors.push(
        `${inv.household.householdCode}: ${e instanceof Error ? e.message : "lỗi"}`
      );
    }
  }

  await logAudit({
    actorId: session.id,
    action: "INVOICES_ZALO_SENT",
    entity: "BillingPeriod",
    entityId: parsed.data.periodId,
    metadata: { sent, skipped, errorCount: errors.length },
  });

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    total: invoices.length,
    errors: errors.slice(0, 10),
  });
}
