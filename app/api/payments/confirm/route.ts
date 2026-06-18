import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@/lib/types/enums";
import {
  authorizeInvoiceAction,
  revalidateStaffBillingPaths,
  requireStaffSession,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { PaymentMethod } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { auditExtraFromRequest } from "@/lib/auditClient";
import { invoiceAuditMetadata } from "@/lib/auditDisplay";
import { z } from "zod";

const schema = z.object({
  invoiceId: z.string(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return staffUnauthorized();

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const denied = await authorizeInvoiceAction(session, parsed.data.invoiceId);
  if (denied) return denied;

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: parsed.data.invoiceId },
    include: {
      household: {
        select: { householdCode: true, meterCode: true, residentName: true },
      },
      period: { select: { month: true, year: true } },
    },
  });

  await prisma.payment.upsert({
    where: { invoiceId: invoice.id },
    create: {
      invoiceId: invoice.id,
      amount: invoice.totalAmount,
      method: parsed.data.method,
      note: parsed.data.note,
      confirmedAt: new Date(),
      confirmedById: session.id,
    },
    update: {
      confirmedAt: new Date(),
      confirmedById: session.id,
      method: parsed.data.method,
      note: parsed.data.note,
    },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: InvoiceStatus.PAID },
  });

  await logAudit({
    actorId: session.id,
    action: "PAYMENT_CONFIRMED",
    entity: "Invoice",
    entityId: invoice.id,
    metadata: invoiceAuditMetadata(invoice, invoice.household, invoice.period, {
      hinhThuc: parsed.data.method,
      ...(parsed.data.note ? { ghiChu: parsed.data.note } : {}),
      ...auditExtraFromRequest(request),
    }),
  });

  revalidateStaffBillingPaths();

  return NextResponse.json({ ok: true });
}
