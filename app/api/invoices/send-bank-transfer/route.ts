import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/lib/types/enums";
import { prisma } from "@/lib/db";
import { sendInvoiceViaN8n, periodLabelFromParts } from "@/lib/n8nInvoice";
import { buildTransferNote } from "@/lib/paymentQr";
import { isExternalPdfUrl } from "@/lib/invoicePdf";
import { logAudit } from "@/lib/audit";
import { invoiceAuditMetadata } from "@/lib/auditDisplay";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.union([
  z.object({ invoiceId: z.string() }),
  z.object({ periodId: z.string() }),
]);

async function sendOne(invoiceId: string, actorId: string) {
  const inv = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { household: true, period: true },
  });

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
    pdfUrl: inv.pdfPath && isExternalPdfUrl(inv.pdfPath) ? inv.pdfPath : undefined,
  });

  await prisma.invoiceSendLog.create({
    data: {
      invoiceId: inv.id,
      channel: "BANK_TRANSFER",
      note: result.skipped ? "webhook chưa cấu hình" : (result.messageId ?? null),
    },
  });

  await logAudit({
    actorId,
    action: "INVOICE_SEND_BANK_TRANSFER",
    entity: "Invoice",
    entityId: inv.id,
    metadata: invoiceAuditMetadata(inv, inv.household, inv.period, {
      skipped: result.skipped ?? false,
    }),
  });

  return { skipped: result.skipped ?? false };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  // Gửi 1 hóa đơn
  if ("invoiceId" in parsed.data) {
    try {
      const { skipped } = await sendOne(parsed.data.invoiceId, session.id);
      revalidatePath("/admin/payments");
      return NextResponse.json({ ok: true, sent: skipped ? 0 : 1, skipped: skipped ? 1 : 0 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Lỗi gửi hóa đơn" },
        { status: 400 }
      );
    }
  }

  // Gửi bulk theo kỳ — chỉ BANK_TRANSFER
  const invoices = await prisma.invoice.findMany({
    where: {
      periodId: parsed.data.periodId,
      status: { in: ["ISSUED"] },
      household: { paymentMethod: "BANK_TRANSFER" },
    },
    select: { id: true },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  const BATCH = 10;
  for (let i = 0; i < invoices.length; i += BATCH) {
    const chunk = invoices.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map((inv) => sendOne(inv.id, session.id))
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        if (r.value.skipped) skipped++;
        else sent++;
      } else {
        errors.push(chunk[j].id + ": " + (r.reason instanceof Error ? r.reason.message : "lỗi"));
      }
    }
  }

  revalidatePath("/admin/payments");

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    total: invoices.length,
    errors: errors.slice(0, 10),
  });
}
