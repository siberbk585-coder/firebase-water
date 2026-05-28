#!/usr/bin/env node
/**
 * Đổi toàn bộ địa chỉ hộ mock sang Thành phố Hải Phòng (regenerate từ lib/seed-data).
 *
 *   unset DATABASE_URL
 *   npm run db:update-addresses-haiphong
 */
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard.ts";

assertDestructiveAllowed("db:update-addresses-haiphong");

import { createPrismaTiennuoc } from "./prisma-tiennuoc.ts";
import { randomAddress } from "../lib/seed-data.ts";

const prisma = await createPrismaTiennuoc();

const households = await prisma.household.findMany({
  orderBy: { householdCode: "asc" },
  select: { id: true, householdCode: true, address: true },
});

let updated = 0;
for (let i = 0; i < households.length; i++) {
  const h = households[i];
  const address = randomAddress(i + 1);
  if (h.address === address) continue;
  await prisma.household.update({ where: { id: h.id }, data: { address } });
  updated++;
}

console.log(`Đã cập nhật ${updated}/${households.length} địa chỉ → Thành phố Hải Phòng`);
await prisma.$disconnect();
