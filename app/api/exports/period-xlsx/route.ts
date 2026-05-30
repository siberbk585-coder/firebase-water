import { NextResponse } from "next/server";
import { UserRole } from "@/lib/types/enums";;
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { periodAuditMetadata } from "@/lib/auditDisplay";
import { prisma } from "@/lib/db";
import {
  buildPeriodRouteExportBuffer,
  periodExportFilename,
} from "@/lib/xlsxExport";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const periodId = new URL(request.url).searchParams.get("periodId");
  if (!periodId) {
    return NextResponse.json({ error: "Thiếu periodId" }, { status: 400 });
  }

  const period = await prisma.billingPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    return NextResponse.json({ error: "Không tìm thấy kỳ" }, { status: 404 });
  }

  const exportedAt = new Date();
  const buffer = await buildPeriodRouteExportBuffer(periodId);
  const filename = periodExportFilename(period.month, period.year, exportedAt);

  await logAudit({
    actorId: session.id,
    action: "XLSX_EXPORT",
    entity: "Export",
    metadata: {
      ...periodAuditMetadata(period),
      filename,
      periodId,
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
