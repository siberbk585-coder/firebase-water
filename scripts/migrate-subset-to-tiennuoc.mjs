#!/usr/bin/env node
/**
 * Copy ~50 user (+ hộ liên quan) từ DB cũ sang DB tiennuoc (Prisma).
 *
 *   SOURCE_DATABASE_URL=postgresql://...old... \
 *   DATABASE_URL=postgresql://...tiennuoc... \
 *   node scripts/migrate-subset-to-tiennuoc.mjs
 */
import { PrismaClient } from "@prisma/client";

const LIMIT = Number(process.env.MIGRATE_USER_LIMIT || "50");
const sourceUrl = process.env.SOURCE_DATABASE_URL;
const destUrl = process.env.DATABASE_URL;

if (!sourceUrl || !destUrl) {
  console.error("Cần SOURCE_DATABASE_URL và DATABASE_URL");
  process.exit(1);
}

const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const dest = new PrismaClient({ datasources: { db: { url: destUrl } } });

async function main() {
  const users = await source.user.findMany({
    take: LIMIT,
    orderBy: { phone: "asc" },
    include: { household: true },
  });
  console.log(`Copy ${users.length} user từ nguồn...`);

  const routes = await source.collectionRoute.findMany();
  const groups = await source.priceGroup.findMany();
  const periods = await source.billingPeriod.findMany({ take: 24, orderBy: [{ year: "desc" }, { month: "desc" }] });

  for (const r of routes) {
    await dest.collectionRoute.upsert({
      where: { code: r.code },
      create: { id: r.id, code: r.code, name: r.name, sortOrder: r.sortOrder, unitPrice: r.unitPrice, createdAt: r.createdAt },
      update: { name: r.name, sortOrder: r.sortOrder, unitPrice: r.unitPrice },
    });
  }
  for (const g of groups) {
    await dest.priceGroup.upsert({
      where: { code: g.code },
      create: { id: g.id, code: g.code, name: g.name, unitPrice: g.unitPrice, createdAt: g.createdAt },
      update: { name: g.name, unitPrice: g.unitPrice },
    });
  }
  for (const p of periods) {
    await dest.billingPeriod.upsert({
      where: { year_month: { year: p.year, month: p.month } },
      create: { id: p.id, year: p.year, month: p.month, status: p.status, createdAt: p.createdAt },
      update: { status: p.status },
    });
  }

  for (const u of users) {
    await dest.user.upsert({
      where: { phone: u.phone },
      create: {
        id: u.id,
        phone: u.phone,
        firebaseUid: u.firebaseUid,
        passwordHash: u.passwordHash,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
      update: {
        firebaseUid: u.firebaseUid,
        passwordHash: u.passwordHash,
        name: u.name,
        role: u.role,
      },
    });
    if (u.household) {
      const h = u.household;
      await dest.household.upsert({
        where: { householdCode: h.householdCode },
        create: {
          id: h.id,
          householdCode: h.householdCode,
          meterCode: h.meterCode,
          address: h.address,
          residentName: h.residentName,
          contactPhone: h.contactPhone,
          status: h.status,
          note: h.note,
          collectionRouteId: h.collectionRouteId,
          routeSortOrder: h.routeSortOrder,
          userId: h.userId,
          priceGroupId: h.priceGroupId,
          createdAt: h.createdAt,
          updatedAt: h.updatedAt,
        },
        update: {
          address: h.address,
          residentName: h.residentName,
          userId: u.id,
        },
      });
    }
  }

  await dest.systemSettings.upsert({
    where: { id: "default" },
    create: { id: "default", periodCloseDay: 25, timezone: "Asia/Ho_Chi_Minh" },
    update: {},
  });

  console.log("Xong. Chạy: npm run firebase:provision-auth");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await dest.$disconnect();
  });
