/**
 * Thêm 20 hộ test (không xóa DB). Đã gộp trong `npm run db:seed` — chỉ dùng script này khi cần bổ sung.
 */
import { PrismaClient, ReadingStatus, UserRole, InputMethod } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";

assertDestructiveAllowed("db:seed-test-residents");

const prisma = new PrismaClient();
const COUNT = 20;
const PASSWORD = "123456";

async function main() {
  const currentPeriod = await prisma.billingPeriod.findFirst({
    where: { status: { not: "CLOSED" } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  if (!currentPeriod) {
    throw new Error("Không tìm thấy kỳ đang mở. Tạo kỳ thu trước khi chạy script.");
  }

  const closedPeriods = await prisma.billingPeriod.findMany({
    where: {
      OR: [
        { year: { lt: currentPeriod.year } },
        { year: currentPeriod.year, month: { lt: currentPeriod.month } },
      ],
    },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    take: 3,
  });

  const [route, priceGroup] = await Promise.all([
    prisma.collectionRoute.findFirst({ orderBy: { sortOrder: "asc" } }),
    prisma.priceGroup.findFirst({ orderBy: { code: "asc" } }),
  ]);
  if (!route || !priceGroup) {
    throw new Error("Thiếu khu vực hoặc nhóm giá. Chạy npm run db:seed trước.");
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const created: { phone: string; mkh: string; name: string }[] = [];
  const skipped: string[] = [];

  for (let n = 1; n <= COUNT; n++) {
    const phone = `0920000${String(n).padStart(3, "0")}`;
    const mkh = `TEST${String(n).padStart(3, "0")}`;
    const meterCode = `TEST${String(n).padStart(5, "0")}`;
    const name = `Hộ test ${n}`;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      skipped.push(phone);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        phone,
        passwordHash,
        name,
        role: UserRole.RESIDENT,
      },
    });

    const baseReading = 200 + n * 3;
    const household = await prisma.household.create({
      data: {
        householdCode: mkh,
        meterCode,
        address: `Nhà test ${n} — ${route.name}`,
        residentName: name,
        contactPhone: phone,
        priceGroupId: priceGroup.id,
        collectionRouteId: route.id,
        routeSortOrder: 900 + n,
        userId: user.id,
      },
    });

    let prevConfirmed = baseReading;
    for (const period of closedPeriods) {
      const usage = 10 + (n % 5);
      const confirmed = prevConfirmed + usage;
      await prisma.meterReading.create({
        data: {
          householdId: household.id,
          periodId: period.id,
          oldReading: prevConfirmed,
          confirmedValue: confirmed,
          usageM3: usage,
          inputMethod: InputMethod.MANUAL,
          status: ReadingStatus.CONFIRMED,
          confirmedAt: new Date(period.year, period.month - 1, 10),
          anomalyFlags: "[]",
        },
      });
      prevConfirmed = confirmed;
    }

    // Kỳ hiện tại: không tạo MeterReading → hộ chưa nhập số
    created.push({ phone, mkh, name });
  }

  console.log(`Kỳ hiện tại: Tháng ${currentPeriod.month}/${currentPeriod.year}`);
  console.log(`Mật khẩu tất cả tài khoản test: ${PASSWORD}`);
  console.log("");
  if (created.length) {
    console.log(`Đã tạo ${created.length} tài khoản (chưa có chỉ số kỳ này):`);
    for (const r of created) {
      console.log(`  ${r.phone}  |  MKH ${r.mkh}  |  ${r.name}`);
    }
  }
  if (skipped.length) {
    console.log(`\nĐã bỏ qua ${skipped.length} SĐT (đã tồn tại): ${skipped.join(", ")}`);
  }
  if (!created.length && skipped.length === COUNT) {
    console.log("Không tạo thêm — chạy lại sau khi xóa user TEST hoặc đổi SĐT trong script.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
