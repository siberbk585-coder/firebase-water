import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { UserRole } from "@/lib/types/enums";;
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { approveReading } from "@/lib/readings";
import { syncInvoiceForConfirmedReading } from "@/lib/invoices";

const schema = z.object({
  readingId: z.string(),
  confirmedValue: z.number().positive().optional(),
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

  try {
    const reading = await approveReading({
      readingId: parsed.data.readingId,
      actorId: session.id,
      confirmedValue: parsed.data.confirmedValue,
    });
    const invoice = await syncInvoiceForConfirmedReading(
      reading.householdId,
      reading.periodId
    );
    const usageM3 =
      reading.usageM3 ??
      (reading.confirmedValue != null
        ? Math.max(0, reading.confirmedValue - reading.oldReading)
        : null);
    revalidatePath("/admin/billing-sheet");
    revalidatePath("/admin/dashboard");
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
    const message = e instanceof Error ? e.message : "Không duyệt được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
