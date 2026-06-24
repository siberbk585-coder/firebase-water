import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizeHouseholdAction,
  isAdminOnlyRole,
  revalidateStaffBillingPaths,
  requireStaffSession,
  staffForbidden,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { auditExtraFromRequest } from "@/lib/auditClient";
import { adminAdjustOldReading } from "@/lib/readings";
import { calculateUsage } from "@/lib/billing";
import { syncInvoiceForConfirmedReading } from "@/lib/invoices";
import { ReadingStatus } from "@/lib/types/enums";

const schema = z.object({
  householdId: z.string(),
  periodId: z.string(),
  oldReading: z.number().min(0),
  reason: z.string().min(3).max(500),
});

export async function POST(request: Request) {
  const session = await requireStaffSession();
  if (!session) return staffUnauthorized();
  if (!isAdminOnlyRole(session)) {
    return staffForbidden("Chỉ quản trị viên được điều chỉnh CSC");
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const { householdId, periodId, oldReading, reason } = parsed.data;
  const denied = await authorizeHouseholdAction(session, householdId);
  if (denied) return denied;

  try {
    const reading = await adminAdjustOldReading({
      householdId,
      periodId,
      oldReading,
      reason,
      actorId: session.id,
      auditExtra: auditExtraFromRequest(request),
      allowPaidEdit: true,
    });

    const invoice =
      reading.status === ReadingStatus.CONFIRMED
        ? await syncInvoiceForConfirmedReading(householdId, periodId, {
            allowPaidUpdate: true,
          })
        : null;

    revalidateStaffBillingPaths();
    return NextResponse.json({
      ok: true,
      reading: {
        id: reading.id,
        oldReading: reading.oldReading,
        confirmedValue: reading.confirmedValue,
        status: reading.status,
        usageM3:
          reading.usageM3 ??
          (reading.confirmedValue != null
            ? calculateUsage(reading.confirmedValue, reading.oldReading)
            : null),
        cscManual: reading.cscManual,
      },
      invoice,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không lưu được";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
