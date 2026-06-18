import { NextResponse } from "next/server";
import { z } from "zod";
import { MobileAdminError } from "@/lib/mobileAdminCollectors";
import { updateHouseholdPaymentMethodForMobile } from "@/lib/mobileAdminHouseholds";
import {
  requireAdminSession,
  staffUnauthorized,
} from "@/lib/staffAuth";

const schema = z.object({
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return staffUnauthorized();

  try {
    const { id } = await params;
    const body = schema.parse(await request.json());
    await updateHouseholdPaymentMethodForMobile(session, id, body.paymentMethod);
    return NextResponse.json({ ok: true });
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
