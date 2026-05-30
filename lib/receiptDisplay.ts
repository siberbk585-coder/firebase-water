/** Hiển thị biên nhận — đồng bộ với app (`billing_row.dart`). */

export function displayResidentName(
  residentName: string,
  householdCode: string
): string {
  const code = householdCode.trim();
  let name = residentName.trim();
  if (!code) return name;

  const patterns = [
    new RegExp(`\\s*[—–\\-·/]\\s*${escapeRegExp(code)}\\s*$`, "i"),
    new RegExp(`\\s*[\\(\\[]\\s*${escapeRegExp(code)}\\s*[\\)\\]]\\s*$`, "i"),
    new RegExp(`\\s+${escapeRegExp(code)}\\s*$`, "i"),
  ];

  for (const p of patterns) {
    const trimmed = name.replace(p, "").trim();
    if (trimmed !== name) {
      name = trimmed;
      break;
    }
  }
  return name;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
