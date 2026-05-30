/** Nhận diện client gọi API (app mobile gửi header X-Client). */
export function auditExtraFromRequest(
  request: Request
): Record<string, unknown> {
  const client =
    request.headers.get("x-client") ?? request.headers.get("X-Client") ?? "";
  const normalized = client.trim().toLowerCase();
  if (
    normalized === "tiennuoc-mobile" ||
    normalized === "mobile" ||
    normalized === "tiennuoc_field"
  ) {
    return { nguon: "MOBILE" };
  }
  return {};
}

export function auditSourceLabel(nguon: unknown): string {
  if (nguon === "MOBILE") return "App tuyến";
  if (nguon === "WEB") return "Web";
  return typeof nguon === "string" ? nguon : "";
}
