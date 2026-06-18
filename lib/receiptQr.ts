import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** QR tối thiểu ~5 dòng; thường bằng chiều cao khối CK trái. */
export const RECEIPT_QR_MIN_LINES = 5;

/** Giới hạn cứng cũ (4 dòng) — giữ cho receiptQrMaxHeightPx / test. */
export const RECEIPT_QR_MAX_LINES = 4;

const DEFAULT_QR_REL = join("public", "receipt", "bank-qr.jpg");

function resolveQrPath(): string | null {
  const custom = process.env.INVOICE_RECEIPT_QR_PATH?.trim();
  if (custom) {
    return custom.startsWith("/") ? custom : join(process.cwd(), custom);
  }
  const fallback = join(process.cwd(), DEFAULT_QR_REL);
  if (existsSync(fallback)) return fallback;
  const altPng = join(process.cwd(), "public", "receipt", "bank-qr.png");
  if (existsSync(altPng)) return altPng;
  return null;
}

/** Chiều cao QR (px SVG) — không vượt quá [lineHeightPx] × [RECEIPT_QR_MAX_LINES]. */
export function receiptQrMaxHeightPx(lineHeightPx: number): number {
  return lineHeightPx * RECEIPT_QR_MAX_LINES;
}

/** Hệ số phóng QR so với chiều cao khối CK trái. */
export const RECEIPT_QR_SIZE_SCALE = 1.1;

/** QR vuông cột phải — cao bằng khối text trái × scale, tối thiểu [RECEIPT_QR_MIN_LINES] dòng. */
export function receiptQrSideColumnSizePx(
  columnWidthPx: number,
  lineHeightPx: number,
  leftBlockHeightPx: number
): number {
  const colMax = Math.max(64, columnWidthPx - 12);
  const minSize = lineHeightPx * RECEIPT_QR_MIN_LINES;
  const base = Math.max(minSize, leftBlockHeightPx);
  return Math.min(colMax, Math.round(base * RECEIPT_QR_SIZE_SCALE));
}

/** Ảnh QR VietQR/Agribank cố định in trên biên nhận. */
export function getReceiptBankQrBuffer(): Buffer | null {
  const path = resolveQrPath();
  if (!path || !existsSync(path)) return null;
  try {
    const buf = readFileSync(path);
    return buf.length > 100 ? buf : null;
  } catch {
    return null;
  }
}

export function receiptBankQrMime(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

export function receiptBankQrDataUri(buffer: Buffer, path?: string): string {
  const mime = path ? receiptBankQrMime(path) : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
