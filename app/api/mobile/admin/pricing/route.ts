import { NextResponse } from "next/server";
import { z } from "zod";
import { MobileAdminError } from "@/lib/mobileAdminCollectors";
import {
  createRouteForMobile,
  getPricingForMobile,
  saveRoutePricesForMobile,
  saveVatForMobile,
} from "@/lib/mobileAdminPricing";
import {
  requireAdminSession,
  staffUnauthorized,
} from "@/lib/staffAuth";

const vatSchema = z.object({
  vatPercent: z.number().min(0).max(100),
});

const pricesSchema = z.object({
  prices: z.array(
    z.object({
      routeId: z.string(),
      unitPrice: z.number().min(0),
    })
  ).min(1),
});

const createRouteSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.number().int().optional(),
  unitPrice: z.number().min(0),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  const data = await getPricingForMobile();
  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  try {
    const body = await request.json();

    if (mode === "vat") {
      const parsed = vatSchema.parse(body);
      const result = await saveVatForMobile(session, parsed.vatPercent);
      return NextResponse.json({ ok: true, ...result });
    }

    if (mode === "prices") {
      const parsed = pricesSchema.parse(body);
      await saveRoutePricesForMobile(session, parsed.prices);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Thiếu mode=vat hoặc mode=prices" }, { status: 400 });
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    throw e;
  }
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  try {
    const body = createRouteSchema.parse(await request.json());
    const result = await createRouteForMobile(session, {
      code: body.code,
      name: body.name,
      sortOrder: body.sortOrder ?? 0,
      unitPrice: body.unitPrice,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof MobileAdminError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }
    throw e;
  }
}
