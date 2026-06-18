import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizeHouseholdAction,
  requireStaffSession,
  staffUnauthorized,
} from "@/lib/staffAuth";
import {
  ensureInvoiceForHouseholdPeriod,
  exportInvoicePdfLocal,
} from "@/lib/invoicePdfLocal";
import { mergePdfBuffers } from "@/lib/mergePdfs";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  periodId: z.string().uuid(),
  householdIds: z.array(z.string().uuid()).min(1).max(80),
});

/** Xuất PDF gộp nhiều hộ (đã chốt CSM) — một file để in hàng loạt. */
export async function POST(request: Request) {
  try {
    const session = await requireStaffSession();
    if (!session) return staffUnauthorized();

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const { periodId, householdIds } = parsed.data;
    const buffers: Buffer[] = [];
    const errors: { householdId: string; message: string }[] = [];

    for (const householdId of householdIds) {
      try {
        const denied = await authorizeHouseholdAction(session, householdId);
        if (denied) {
          errors.push({ householdId, message: "Không có quyền trên hộ này" });
          continue;
        }
        const invoiceId = await ensureInvoiceForHouseholdPeriod(householdId, periodId);
        const { buffer } = await exportInvoicePdfLocal(invoiceId);
        buffers.push(buffer);
      } catch (e) {
        errors.push({
          householdId,
          message: e instanceof Error ? e.message : "Lỗi xuất PDF",
        });
      }
    }

    if (!buffers.length) {
      return NextResponse.json(
        { error: "Không xuất được hóa đơn nào", details: errors },
        { status: 400 }
      );
    }

    const merged = await mergePdfBuffers(buffers);
    const filename = `hoa-don-batch-${buffers.length}.pdf`;

    return new NextResponse(new Uint8Array(merged), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Invoice-Count": String(buffers.length),
        "X-Invoice-Errors": String(errors.length),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không xuất được PDF hàng loạt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
