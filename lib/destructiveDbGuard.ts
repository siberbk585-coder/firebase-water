/**
 * Chặn script seed/reshape trên database production (tiennuoc_water).
 * Dữ liệu production chỉ thay đổi qua UI/API người dùng.
 */

const PROD_DB_MARKERS = ["tiennuoc_water", "cloudsql/tiennuoc", "tiennuoc-db"];

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL?.trim() ?? "";
}

export function isProductionDatabase(url = getDatabaseUrl()): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return PROD_DB_MARKERS.some((m) => lower.includes(m));
}

export function destructiveOverrideEnabled(): boolean {
  return process.env.ALLOW_DESTRUCTIVE_DB === "yes-I-know";
}

export function assertDestructiveAllowed(scriptName: string): void {
  const url = getDatabaseUrl();
  if (!isProductionDatabase(url)) return;

  if (destructiveOverrideEnabled()) {
    console.warn(
      `[db-guard] ALLOW_DESTRUCTIVE_DB=yes-I-know — cho phép "${scriptName}" trên DB production.`
    );
    return;
  }

  throw new Error(
    [
      `[db-guard] Từ chối "${scriptName}" trên database production.`,
      `URL hiện tại trỏ tới tiennuoc (Cloud SQL). Danh sách hộ/chỉ số chỉ được sửa trên web app.`,
      ``,
      `Nếu BẮT BUỘC chạy script (hiểu rủi ro):`,
      `  ALLOW_DESTRUCTIVE_DB=yes-I-know npm run <script>`,
      ``,
      `Kiểm tra DB (chỉ đọc): npm run db:audit`,
    ].join("\n")
  );
}
