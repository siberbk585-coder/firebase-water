import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { UserRole } from "@/lib/types/enums";;
import {
  ensureInvoiceForHouseholdPeriod,
  exportInvoicePdfLocal,
} from "@/lib/invoicePdfLocal";
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
