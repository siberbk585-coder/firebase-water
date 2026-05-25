import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/lib/types/enums";;
import { exportInvoicePdfLocal } from "@/lib/invoicePdfLocal";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Xuất 1 PDF, lưu link n8n nếu bật webhook hoặc fallback local khi dev. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
    }

    const { id } = await params;
    const { buffer, meterCode } = await exportInvoicePdfLocal(id);

    try {
      await logAudit({
        actorId: session.id,
        action: "INVOICE_EXPORT_LOCAL",
        entity: "Invoice",
        entityId: id,
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
