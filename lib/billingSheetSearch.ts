export const BILLING_SHEET_SEARCH_EVENT = "billing-sheet-search";

export type BillingSheetSearchableRow = {
  householdCode: string;
  meterCode?: string | null;
  residentName: string;
  address?: string | null;
  contactPhone?: string | null;
  routeName?: string | null;
};

type TokenPart = { raw: string; norm: string };
type NamePart = { raw: string; norm: string };

export function normalizeBillingSheetSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Giữ nguyên dấu tiếng Việt — chỉ hạ chữ hoa. */
export function foldCasePreserveDiacritics(value: string): string {
  return value.trim().toLocaleLowerCase("vi");
}

export function buildBillingSheetSearchHaystack(
  row: BillingSheetSearchableRow
): string {
  return [
    row.householdCode,
    row.meterCode ?? "",
    row.residentName,
    row.address ?? "",
    row.contactPhone ?? "",
    row.routeName ?? "",
  ]
    .map(normalizeBillingSheetSearch)
    .join(" ");
}

export function queryTokenParts(rawQuery: string): TokenPart[] {
  return rawQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeBillingSheetSearch(raw) }));
}

/** @deprecated dùng queryTokenParts */
export function searchTokens(rawQuery: string): string[] {
  return queryTokenParts(rawQuery).map((p) => p.norm);
}

export function nameParts(residentName: string): NamePart[] {
  return residentName
    .split(/[\s,.;/\-]+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalizeBillingSheetSearch(raw) }));
}

/** @deprecated dùng nameParts */
export function nameWords(residentName: string): string[] {
  return nameParts(residentName).map((p) => p.norm);
}

/** Điểm khớp từ tên — ưu tiên đúng dấu (Dương > Đương). */
export function nameWordScore(query: TokenPart, word: NamePart): number {
  const qFold = foldCasePreserveDiacritics(query.raw);
  const wFold = foldCasePreserveDiacritics(word.raw);

  if (qFold === wFold) return 200;
  if (qFold.length >= 2 && wFold.startsWith(qFold)) return 175;
  if (qFold.length >= 2 && wFold.includes(qFold)) return 160;

  if (word.norm === query.norm) return 100;
  if (word.norm.startsWith(query.norm)) return 85;
  if (query.norm.length >= 3 && word.norm.includes(query.norm)) return 70;
  return 0;
}

function fieldScores(token: string, row: BillingSheetSearchableRow): number {
  if (!token) return 0;

  const code = normalizeBillingSheetSearch(row.householdCode);
  const meter = normalizeBillingSheetSearch(row.meterCode ?? "");
  const phone = normalizeBillingSheetSearch(row.contactPhone ?? "");
  const address = normalizeBillingSheetSearch(row.address ?? "");
  const route = normalizeBillingSheetSearch(row.routeName ?? "");

  let best = 0;
  if (code === token) best = Math.max(best, 95);
  else if (code.includes(token)) best = Math.max(best, 55);
  if (meter === token) best = Math.max(best, 90);
  else if (meter.includes(token)) best = Math.max(best, 50);
  if (phone.includes(token)) best = Math.max(best, 45);
  if (token.length >= 2 && address.includes(token)) best = Math.max(best, 25);
  if (token.length >= 2 && route.includes(token)) best = Math.max(best, 20);
  return best;
}

/** Điểm khớp một token (0 = không khớp). */
export function tokenMatchScore(
  part: TokenPart,
  row: BillingSheetSearchableRow
): number {
  let best = 0;
  for (const w of nameParts(row.residentName)) {
    best = Math.max(best, nameWordScore(part, w));
  }
  return Math.max(best, fieldScores(part.norm, row));
}

export function billingSheetSearchScore(
  row: BillingSheetSearchableRow,
  rawQuery: string
): number {
  const parts = queryTokenParts(rawQuery);
  if (!parts.length) return 0;
  return parts.reduce((sum, part) => sum + tokenMatchScore(part, row), 0);
}

export function matchesBillingSheetSearchHaystack(
  haystack: string,
  rawQuery: string,
  residentName = ""
): boolean {
  if (!residentName) {
    const parts = queryTokenParts(rawQuery);
    if (!parts.length) return true;
    return parts.every((p) => haystack.includes(p.norm));
  }
  const row: BillingSheetSearchableRow = { householdCode: "", residentName };
  return matchesBillingSheetSearch(row, rawQuery);
}

export function matchesBillingSheetSearch(
  row: BillingSheetSearchableRow,
  rawQuery: string
): boolean {
  const parts = queryTokenParts(rawQuery);
  if (!parts.length) return true;

  const words = nameParts(row.residentName);
  const used = words.map(() => false);

  for (const part of parts) {
    let matched = false;
    for (let i = 0; i < words.length; i++) {
      if (used[i]) continue;
      if (nameWordScore(part, words[i]!) > 0) {
        used[i] = true;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (fieldScores(part.norm, row) > 0) continue;
    return false;
  }
  return true;
}
