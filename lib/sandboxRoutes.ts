import type { Prisma } from "@prisma/client";

/** Mã tuyến sandbox (guest tester, Google Play review) — ẩn khỏi vận hành thật. */
export const SANDBOX_ROUTE_PREFIXES = ["GUEST-", "PLAY-"] as const;

export function isSandboxRouteCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  return SANDBOX_ROUTE_PREFIXES.some((p) => c.startsWith(p));
}

export function isSandboxUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  const u = username.trim().toLowerCase();
  return u === "playreview" || /^guest\d{2}$/.test(u);
}

export function excludeSandboxRoutesWhere(): Prisma.CollectionRouteWhereInput {
  return {
    NOT: {
      OR: SANDBOX_ROUTE_PREFIXES.map((prefix) => ({
        code: { startsWith: prefix, mode: "insensitive" },
      })),
    },
  };
}

/** Hộ không thuộc tuyến sandbox (vẫn giữ hộ chưa gán tuyến). */
export function excludeSandboxHouseholdWhere(): Prisma.HouseholdWhereInput {
  return {
    OR: [
      { collectionRouteId: null },
      { collectionRoute: excludeSandboxRoutesWhere() },
    ],
  };
}

export function excludeSandboxCollectorsWhere(): Prisma.UserWhereInput {
  return {
    NOT: {
      OR: [
        { username: { equals: "playreview", mode: "insensitive" } },
        {
          AND: [
            { username: { startsWith: "guest", mode: "insensitive" } },
            { username: { not: null } },
          ],
        },
      ],
    },
  };
}

export function mergeProductionHouseholdWhere(
  ...parts: Prisma.HouseholdWhereInput[]
): Prisma.HouseholdWhereInput {
  return { AND: [...parts, excludeSandboxHouseholdWhere()] };
}
