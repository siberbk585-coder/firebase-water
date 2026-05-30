/**
 * Kiểm tra và đổi tên hộ (resident_name) để không còn trùng nhau.
 *
 *   npm run db:dedupe-names              # xem trước (dry-run)
 *   npm run db:dedupe-names -- --apply   # ghi DB
 *
 * Production: cần Cloud SQL proxy + ALLOW_DESTRUCTIVE_DB=yes-I-know
 */
import { PrismaClient } from "@prisma/client";
import { assertDestructiveAllowed } from "../lib/destructiveDbGuard";
import { createPrismaTiennuoc } from "./prisma-tiennuoc";

const APPLY = process.argv.includes("--apply");

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function stripCodeSuffix(name: string): string {
  return name.replace(/\s+[—–-]\s+[A-Z0-9]+$/i, "").trim();
}

function suffixName(base: string, householdCode: string): string {
  const suffix = ` — ${householdCode}`;
  if (base.endsWith(suffix)) return base;
  return `${base}${suffix}`;
}

function baseNameForGroup(
  group: { residentName: string; householdCode: string }[]
): string {
  const stripped = group.map((h) => stripCodeSuffix(h.residentName));
  const norm = normalizeName(stripped[0]!);
  for (const h of group) {
    const s = stripCodeSuffix(h.residentName);
    if (normalizeName(s) === norm && s.length > 0) return s;
  }
  return stripped[0]!;
}

async function main() {
  if (APPLY) assertDestructiveAllowed("db:dedupe-names");

  const url = process.env.DATABASE_URL?.trim();
  const prisma = url ? new PrismaClient() : await createPrismaTiennuoc();

  try {
    const households = await prisma.household.findMany({
      orderBy: { householdCode: "asc" },
      select: {
        id: true,
        householdCode: true,
        meterCode: true,
        residentName: true,
        userId: true,
      },
    });

    const byNorm = new Map<string, typeof households>();
    for (const h of households) {
      const key = normalizeName(h.residentName);
      const list = byNorm.get(key) ?? [];
      list.push(h);
      byNorm.set(key, list);
    }

    const duplicateGroups = [...byNorm.entries()].filter(([, g]) => g.length > 1);

    console.log(`=== Tên hộ dân — ${households.length} hộ ===\n`);
    console.log(`Nhóm tên trùng (không phân biệt hoa thường): ${duplicateGroups.length}`);

    if (!duplicateGroups.length) {
      console.log("Không có tên trùng — không cần đổi.");
      return;
    }

    const updates: Array<{
      id: string;
      householdCode: string;
      oldName: string;
      newName: string;
      userId: string | null;
    }> = [];

    for (const [, group] of duplicateGroups) {
      const sorted = [...group].sort((a, b) =>
        a.householdCode.localeCompare(b.householdCode)
      );
      const base = baseNameForGroup(sorted);
      for (const h of sorted) {
        const newName = suffixName(base, h.householdCode);
        if (normalizeName(h.residentName) !== normalizeName(newName)) {
          updates.push({
            id: h.id,
            householdCode: h.householdCode,
            oldName: h.residentName,
            newName,
            userId: h.userId,
          });
        }
      }
    }

    console.log(`Sẽ đổi tên: ${updates.length} hộ\n`);
    for (const u of updates.slice(0, 40)) {
      console.log(`  ${u.householdCode}: "${u.oldName}" → "${u.newName}"`);
    }
    if (updates.length > 40) {
      console.log(`  … và ${updates.length - 40} hộ nữa`);
    }

    if (!APPLY) {
      console.log(
        "\nChạy thật: npm run db:dedupe-names -- --apply"
      );
      if (url && url.includes("tiennuoc")) {
        console.log(
          "Production: ALLOW_DESTRUCTIVE_DB=yes-I-know npm run db:dedupe-names -- --apply"
        );
      }
      return;
    }

    let done = 0;
    for (const u of updates) {
      await prisma.household.update({
        where: { id: u.id },
        data: { residentName: u.newName },
      });
      if (u.userId) {
        await prisma.user.update({
          where: { id: u.userId },
          data: { name: u.newName },
        });
      }
      done++;
    }
    console.log(`\nĐã cập nhật ${done} hộ (+ user gắn hộ nếu có).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
