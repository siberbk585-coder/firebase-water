#!/usr/bin/env node
/**
 * Tạo admin + kỳ tháng hiện tại trên DB tiennuoc (cần DATABASE_URL).
 */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const hash = await bcrypt.hash("123456", 10);

  const period = await prisma.billingPeriod.upsert({
    where: { year_month: { year: now.getFullYear(), month: now.getMonth() + 1 } },
    create: { year: now.getFullYear(), month: now.getMonth() + 1 },
    update: {},
  });

  const group = await prisma.priceGroup.upsert({
    where: { code: "MAC_DINH" },
    create: { code: "MAC_DINH", name: "Giá mặc định", unitPrice: 15000 },
    update: {},
  });

  await prisma.user.upsert({
    where: { phone: "admin" },
    create: {
      phone: "admin",
      name: "Quản trị",
      role: UserRole.ADMIN,
      passwordHash: hash,
    },
    update: { passwordHash: hash, role: UserRole.ADMIN },
  });

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  console.log("Demo seed OK — admin/123456, period", period.year, period.month, "priceGroup", group.code);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
