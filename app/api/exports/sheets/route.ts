import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exportReadingsCsv, pushToGoogleSheet } from "@/lib/sheetsExport";
import { logAudit } from "@/lib/audit";
import { UserRole } from "@/lib/types/enums";;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const periodId = new URL(request.url).searchParams.get("periodId") ?? undefined;
  const csv = await exportReadingsCsv(periodId ?? undefined);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="readings-export.csv"',
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const periodId = new URL(request.url).searchParams.get("periodId") ?? undefined;
  const csv = await exportReadingsCsv(periodId ?? undefined);
  const result = await pushToGoogleSheet(csv);

  await logAudit({
    actorId: session.id,
    action: "SHEETS_EXPORT",
    entity: "Export",
    metadata: { periodId, ...result },
  });

  return NextResponse.json(result);
}
