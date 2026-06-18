import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizeHouseholdAction,
  revalidateStaffBillingPaths,
  requireStaffSession,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { approveReading } from "@/lib/readings";
import { prisma } from "@/lib/db";
import { syncInvoiceForConfirmedReading } from "@/lib/invoices";

const schema = z.object({
  readingId: z.string(),
  confirmedValue: z.number().positive().optional(),
});

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return staffUnauthorized();

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.meterReading.findUnique({
    where: { id: parsed.data.readingId },
    select: { householdId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Không tìm thấy chỉ số" }, { status: 404 });
  }
  const denied = await authorizeHouseholdAction(session, existing.householdId);
  if (denied) return denied;

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
    revalidateStaffBillingPaths();
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
