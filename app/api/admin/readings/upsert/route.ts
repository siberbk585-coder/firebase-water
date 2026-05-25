import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@/lib/types/enums";;
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { adminUpsertReading } from "@/lib/readings";
import { calculateUsage } from "@/lib/billing";
import { syncInvoiceForConfirmedReading } from "@/lib/invoices";
import { prisma } from "@/lib/db";

const schema = z.object({
  householdId: z.string(),
  periodId: z.string(),
  confirmedValue: z.number().positive(),
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

  const { householdId, periodId, confirmedValue } = parsed.data;

  const household = await prisma.household.findUnique({
    where: { id: householdId },
  });
  if (!household) {
    return NextResponse.json({ error: "Không tìm thấy hộ" }, { status: 404 });
  }

  try {
    const reading = await adminUpsertReading({
      householdId,
      periodId,
      confirmedValue,
      actorId: session.id,
    });
    const usageM3 = reading.usageM3 ?? calculateUsage(confirmedValue, reading.oldReading);
    const invoice = await syncInvoiceForConfirmedReading(householdId, periodId);
    revalidatePath("/admin/billing-sheet");
    return NextResponse.json({
      ok: true,
      reading: {
        id: reading.id,
        confirmedValue: reading.confirmedValue,
        usageM3,
        status: reading.status,
      },
      invoice,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
