import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/lib/types/enums";;
import {
  ensureInvoiceForHouseholdPeriod,
  exportInvoicePdfLocal,
} from "@/lib/invoicePdfLocal";
import { logAudit } from "@/lib/audit";
import { auditExtraFromRequest } from "@/lib/auditClient";
import { invoiceAuditMetadata } from "@/lib/auditDisplay";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  householdId: z.string(),
  periodId: z.string(),
});

/** Xuất PDF một hộ (tự tạo hóa đơn nếu chưa có, lưu link n8n nếu bật). */
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

    const invoiceId = await ensureInvoiceForHouseholdPeriod(
      parsed.data.householdId,
      parsed.data.periodId
    );
    const { buffer, meterCode } = await exportInvoicePdfLocal(invoiceId);

    try {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: invoiceId },
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
        entityId: invoiceId,
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
        "X-Invoice-Id": invoiceId,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Không xuất được PDF";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
