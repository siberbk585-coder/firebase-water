import { NextResponse } from "next/server";
import { UserRole } from "@/lib/types/enums";;
import { getSession } from "@/lib/auth";
import { importPeriodRouteWorkbook } from "@/lib/xlsxImport";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const form = await request.formData();
  const periodId = String(form.get("periodId") ?? "");
  const file = form.get("file");

  if (!periodId) {
    return NextResponse.json({ error: "Thiếu periodId" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Thiếu file Excel" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importPeriodRouteWorkbook({
    periodId,
    buffer,
    actorId: session.id,
  });

  const url = new URL("/admin/billing-sheet", request.url);
  url.searchParams.set("route", "all");
  url.searchParams.set("imported", String(result.readingUpdated));
  url.searchParams.set("paid", String(result.paymentUpdated));
  url.searchParams.set("errors", String(result.errors.length));
  url.searchParams.set("durationMs", String(result.durationMs));
  if (result.errors[0]) {
    url.searchParams.set("message", result.errors[0]);
  }

  return NextResponse.redirect(url, { status: 303 });
}
