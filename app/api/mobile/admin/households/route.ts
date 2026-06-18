import { HouseholdStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MobileAdminError } from "@/lib/mobileAdminCollectors";
import {
  createHouseholdForMobile,
  listHouseholdsForMobile,
} from "@/lib/mobileAdminHouseholds";
import {
  requireAdminSession,
  staffUnauthorized,
} from "@/lib/staffAuth";

const createSchema = z.object({
  householdCode: z.string().trim().min(1),
  meterCode: z.string().trim().min(1),
  residentName: z.string().trim().min(1),
  address: z.string().trim().min(1),
  collectionRouteId: z.string().trim().min(1),
  contactPhone: z.string().optional(),
  appPhone: z.string().optional(),
  appPassword: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const page = parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(url.searchParams.get("pageSize") ?? "50", 10);
  const statusParam = url.searchParams.get("status");
  const routeId = url.searchParams.get("routeId")?.trim() || undefined;

  let status: HouseholdStatus | undefined;
  if (statusParam === HouseholdStatus.ACTIVE || statusParam === HouseholdStatus.INACTIVE) {
    status = statusParam;
  }

  const data = await listHouseholdsForMobile(
    q,
    Number.isFinite(page) ? page : 1,
    Number.isFinite(pageSize) ? Math.min(pageSize, 100) : 50,
    { status, routeId }
  );
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  try {
    const body = createSchema.parse(await request.json());
    const result = await createHouseholdForMobile(session, body);
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
