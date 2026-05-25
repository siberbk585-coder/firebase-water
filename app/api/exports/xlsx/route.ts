import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { buildFullExportBuffer, exportFilename } from "@/lib/xlsxExport";
import { UserRole } from "@/lib/types/enums";;

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const buffer = await buildFullExportBuffer();
  const filename = exportFilename();

  await logAudit({
    actorId: session.id,
    action: "XLSX_EXPORT",
    entity: "Export",
    metadata: { filename },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
