/** Domain email ảo cho tài khoản dạng số điện thoại / admin (Firebase cần email). */
const DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN ||
  process.env.AUTH_EMAIL_DOMAIN ||
  "accounts.tiennuoc.local";

export function accountToAuthEmail(account: string): string {
  const t = account.trim().toLowerCase();
  if (t.includes("@")) return t;
  return `${t}@${DOMAIN}`;
}

export function authEmailToAccount(email: string): string {
  const lower = email.trim().toLowerCase();
  const suffix = `@${DOMAIN}`;
  if (lower.endsWith(suffix)) return lower.slice(0, -suffix.length);
  return lower;
}
