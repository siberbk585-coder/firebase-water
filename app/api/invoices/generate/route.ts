import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { UserRole, ReadingStatus } from "@/lib/types/enums";;
import { prisma } from "@/lib/db";
import { syncInvoiceForConfirmedReading } from "@/lib/invoices";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ periodId: z.string() });

export const runtime = "nodejs";
export const maxDuration = 120;

/** Chốt hóa đơn kỳ: tính tổng tiền cho mọi hộ đã chốt CSM (không tạo PDF). */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const readings = await prisma.meterReading.findMany({
      where: {
        periodId: parsed.data.periodId,
        status: ReadingStatus.CONFIRMED,
      },
      select: { householdId: true, periodId: true },
    });

    if (!readings.length) {
      return NextResponse.json({
        error: "Không có chỉ số đã chốt trong kỳ này. Chốt CSM trên bảng thu trước.",
      });
    }

    let created = 0;
    const errors: string[] = [];

    for (const r of readings) {
      try {
        const inv = await syncInvoiceForConfirmedReading(r.householdId, r.periodId);
        if (inv) created++;
      } catch (e) {
        const h = await prisma.household.findUnique({
          where: { id: r.householdId },
          select: { householdCode: true },
        });
        const msg = e instanceof Error ? e.message : "Lỗi";
        errors.push(`${h?.householdCode ?? r.householdId}: ${msg}`);
      }
    }

    try {
      await logAudit({
        actorId: session.id,
        action: "INVOICES_GENERATED",
        entity: "BillingPeriod",
        entityId: parsed.data.periodId,
        metadata: { count: created, failed: errors.length },
      });
    } catch (auditErr) {
      console.error("[invoices/generate] audit log failed", auditErr);
    }

    revalidatePath("/admin/billing-sheet");
    revalidatePath("/admin/payments");
    return NextResponse.json({
      ok: true,
      created,
      failed: errors.length,
      errors: errors.slice(0, 8),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không chốt được hóa đơn";
    console.error("[invoices/generate]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
