import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InvoiceStatus, UserRole } from "@/lib/types/enums";
import { PaymentMethod } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({
  invoiceId: z.string(),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  note: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: parsed.data.invoiceId },
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
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/billing-sheet");
  revalidatePath("/admin/dashboard");

  return NextResponse.json({ ok: true });
}
