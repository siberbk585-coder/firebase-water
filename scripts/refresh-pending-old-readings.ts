/**
 * Đồng bộ CSC (old_reading) cho mọi chỉ số PENDING/REJECTED theo chuỗi kỳ đã chốt.
 *
 *   ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:refresh-pending-old-readings
 */
import { ReadingStatus } from "@prisma/client";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";
import { getOldReading } from "../lib/readings";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";

assertDestructiveAllowed("db:refresh-pending-old-readings");

async function main() {
  const prisma = await createPrismaTiennuoc();
  try {
    const pending = await prisma.meterReading.findMany({
      where: {
        status: { in: [ReadingStatus.PENDING, ReadingStatus.REJECTED] },
        cscManual: false,
      },
      select: { id: true, householdId: true, periodId: true, oldReading: true },
    });

    let updated = 0;
    for (const r of pending) {
      const chain = await getOldReading(r.householdId, r.periodId);
      if (r.oldReading !== chain) {
        await prisma.meterReading.update({
          where: { id: r.id },
          data: { oldReading: chain },
        });
        updated++;
      }
    }
    console.log(
      `Đã kiểm tra ${pending.length} bản ghi chưa chốt — cập nhật CSC ${updated} bản ghi.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
