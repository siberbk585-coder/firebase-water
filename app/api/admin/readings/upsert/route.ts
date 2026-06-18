import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizeHouseholdAction,
  isAdminOnlyRole,
  revalidateStaffBillingPaths,
  requireStaffSession,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { auditExtraFromRequest } from "@/lib/auditClient";
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
  const session = await requireStaffSession();
  if (!session) return staffUnauthorized();

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const { householdId, periodId, confirmedValue } = parsed.data;
  const denied = await authorizeHouseholdAction(session, householdId);
  if (denied) return denied;

  const household = await prisma.household.findUnique({
    where: { id: householdId },
  });
  if (!household) {
    return NextResponse.json({ error: "Không tìm thấy hộ" }, { status: 404 });
  }

  try {
    const allowPaidEdit = isAdminOnlyRole(session);
    const reading = await adminUpsertReading({
      householdId,
      periodId,
      confirmedValue,
      actorId: session.id,
      auditExtra: auditExtraFromRequest(request),
      allowPaidEdit,
    });
    const usageM3 = reading.usageM3 ?? calculateUsage(confirmedValue, reading.oldReading);
    const invoice = await syncInvoiceForConfirmedReading(householdId, periodId, {
      allowPaidUpdate: allowPaidEdit,
    });
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
    const message = e instanceof Error ? e.message : "Không lưu được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
