import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PeriodStatus, UserRole } from "@/lib/types/enums";;
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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

  const existing = await prisma.billingPeriod.findUnique({
    where: { id: parsed.data.periodId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Kỳ không tồn tại" }, { status: 404 });
  }
  if (existing.status !== PeriodStatus.OPEN) {
    return NextResponse.json({ error: "Kỳ đã đóng" }, { status: 400 });
  }

  const period = await prisma.billingPeriod.update({
    where: { id: parsed.data.periodId },
    data: { status: PeriodStatus.CLOSED },
  });

  await logAudit({
    actorId: session.id,
    action: "PERIOD_CLOSED",
    entity: "BillingPeriod",
    entityId: period.id,
  });

  revalidatePath("/admin/billing-sheet");
  revalidatePath("/admin/dashboard");
  return NextResponse.json({ ok: true, period });
}
