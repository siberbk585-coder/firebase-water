import { NextResponse } from "next/server";
import {
  authorizeInvoiceAction,
  requireStaffSession,
  staffUnauthorized,
} from "@/lib/staffAuth";
import { exportInvoicePdfLocal } from "@/lib/invoicePdfLocal";
import { logAudit } from "@/lib/audit";
import { auditExtraFromRequest } from "@/lib/auditClient";
import { invoiceAuditMetadata } from "@/lib/auditDisplay";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** Xuất 1 PDF, lưu link n8n nếu bật webhook hoặc fallback local khi dev. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireStaffSession();
    if (!session) return staffUnauthorized();

    const { id } = await params;
    const denied = await authorizeInvoiceAction(session, id);
    if (denied) return denied;
    const { buffer, meterCode } = await exportInvoicePdfLocal(id);

    try {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id },
        include: {
          household: {
            select: { householdCode: true, meterCode: true, residentName: true },
          },
          period: { select: { month: true, year: true } },
        },
      });
      await logAudit({
        actorId: session.id,
        action: "INVOICE_EXPORT_LOCAL",
        entity: "Invoice",
        entityId: id,
        metadata: invoiceAuditMetadata(
          invoice,
          invoice.household,
          invoice.period,
          auditExtraFromRequest(request)
        ),
      });
    } catch {
      /* audit không chặn tải file */
    }

    const filename = `hoa-don-${meterCode}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không xuất được PDF";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
