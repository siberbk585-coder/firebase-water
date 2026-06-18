/** Hiển thị biên nhận — đồng bộ với app (`billing_row.dart`). */

/** Hậu tố địa chỉ in trên biên nhận (xã / thành phố) — không dấu. */
export const RECEIPT_ADDRESS_SUFFIX = "xa Tien Minh, TP Hai Phong";

/** Gỡ dấu tiếng Việt — đồng bộ `printer_text.dart` / bill in nhiệt. */
export function receiptAscii(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[—–‐‑−]/g, "-")
    .replace(/[""„]/g, '"')
    .replace(/[''‚]/g, "'")
    .replace(/…/g, "...")
    .replace(/·/g, ".")
    .replace(/°/g, "o")
    .replace(/³/g, "3");
}

/** Địa chỉ in biên nhận — nối hậu tố xã/TP nếu chưa có. */
export function formatReceiptAddress(
  address: string | null | undefined,
  fallbackRoute?: string | null
): string {
  const base = receiptAscii(
    address?.trim() || fallbackRoute?.trim() || ""
  );
  if (!base || base === "-") return RECEIPT_ADDRESS_SUFFIX;
  const suffixLower = RECEIPT_ADDRESS_SUFFIX.toLowerCase();
  if (base.toLowerCase().includes(suffixLower)) return base;
  return `${base}, ${RECEIPT_ADDRESS_SUFFIX}`;
}

/** Thông tin CK in cuối biên nhận — mặc định Agribank HTX Tiên Lãng. */
export const RECEIPT_BANK_ACCOUNT_HOLDER =
  "Hop tac xa thuy san va DV moi truong Tien Lang";
export const RECEIPT_BANK_ACCOUNT_NUMBER = "2106201002368";
export const RECEIPT_BANK_NAME = "Agribank";

/** @deprecated dùng RECEIPT_BANK_ACCOUNT_HOLDER (đã không dấu) */
export const RECEIPT_BANK_ACCOUNT_HOLDER_ASCII = RECEIPT_BANK_ACCOUNT_HOLDER;

export type ReceiptBankTransferInfo = {
  accountHolder: string;
  accountNumber: string;
  bankName: string;
};

export function getReceiptBankTransferInfo(): ReceiptBankTransferInfo {
  const holder =
    process.env.BANK_ACCOUNT_NAME?.trim() || RECEIPT_BANK_ACCOUNT_HOLDER;
  return {
    accountHolder: receiptAscii(holder),
    accountNumber:
      process.env.BANK_ACCOUNT?.trim() || RECEIPT_BANK_ACCOUNT_NUMBER,
    bankName: receiptAscii(
      process.env.BANK_NAME?.trim() || RECEIPT_BANK_NAME
    ),
  };
}

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
