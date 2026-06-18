import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runOcrOnImage, needsManualEntry } from "@/lib/ocr";
import { saveBuffer } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { getOldReading } from "@/lib/readings";
import { isHouseholdBillableInPeriod } from "@/lib/householdBillable";
import { ReadingStatus } from "@/lib/types/enums";;
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.householdId) {
    return NextResponse.json({ error: "Chưa đăng nhập hoặc chưa gắn hộ dân" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("image") as File | null;
  const periodId = form.get("periodId") as string | null;
  if (!file || !periodId) {
    return NextResponse.json({ error: "Thiếu ảnh hoặc kỳ ghi nước" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "jpg";

  const [household, period, ocr, oldReading, imagePath] = await Promise.all([
    prisma.household.findUniqueOrThrow({
      where: { id: session.householdId },
      select: {
        status: true,
        inactiveFromYear: true,
        inactiveFromMonth: true,
      },
    }),
    prisma.billingPeriod.findUniqueOrThrow({
      where: { id: periodId },
      select: { year: true, month: true },
    }),
    runOcrOnImage(buffer),
    getOldReading(session.householdId, periodId),
    saveBuffer("readings", `${randomUUID()}.${ext}`, buffer),
  ]);

  if (!isHouseholdBillableInPeriod(household, period.year, period.month)) {
    return NextResponse.json(
      { error: "Hộ đã ngưng sử dụng — không thể gửi chỉ số kỳ này." },
      { status: 403 }
    );
  }

  const existing = await prisma.meterReading.findUnique({
    where: {
      householdId_periodId: {
        householdId: session.householdId,
        periodId,
      },
    },
  });

  const data = {
    householdId: session.householdId,
    periodId,
    oldReading,
    ocrValue: ocr.value,
    confidence: ocr.confidence,
    imagePath,
    status: ReadingStatus.PENDING,
    anomalyFlags: "[]",
  };

  const reading = existing
    ? await prisma.meterReading.update({ where: { id: existing.id }, data })
    : await prisma.meterReading.create({ data });

  return NextResponse.json({
    readingId: reading.id,
    ocrValue: ocr.value,
    rawText: ocr.rawText,
    confidence: ocr.confidence,
    needsManual: needsManualEntry(ocr.confidence),
    oldReading,
  });
}
