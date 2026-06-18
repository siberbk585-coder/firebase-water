import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizeHouseholdAction,
  revalidateStaffBillingPaths,
  requireStaffSession,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { rejectReading } from "@/lib/readings";
import { prisma } from "@/lib/db";

const schema = z.object({
  readingId: z.string(),
  reason: z.string().optional(),
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
    const reading = await rejectReading({
      readingId: parsed.data.readingId,
      actorId: session.id,
      reason: parsed.data.reason,
    });
    revalidateStaffBillingPaths();
    return NextResponse.json({ ok: true, reading });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không từ chối được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
