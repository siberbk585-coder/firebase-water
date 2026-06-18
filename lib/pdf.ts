import { PDFDocument } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import { join } from "path";
import { amountInWordsVn } from "./amountInWords";
import {
  displayResidentName,
  formatReceiptAddress,
  getReceiptBankTransferInfo,
  receiptAscii,
} from "./receiptDisplay";
import {
  getReceiptBankQrBuffer,
  receiptBankQrDataUri,
  receiptQrSideColumnSizePx,
} from "./receiptQr";
import { receiptUnitPriceDisplay } from "./vat";

/** Font kiểu máy in bill / siêu thị (monospace, hẹp). */
const RECEIPT_FONT = "'Roboto Mono', monospace";
const TTF_BASE = join(process.cwd(), "public/fonts");
const RECEIPT_TTF = ["RobotoMono-Regular.ttf", "RobotoMono-Bold.ttf"] as const;

function fontFilePaths(): string[] {
  return RECEIPT_TTF.map((f) => join(TTF_BASE, f));
}

/** Khổ giấy nhiệt ~80mm */
const RECEIPT_PT_WIDTH = 226.77;
const SVG_WIDTH = 560;
const PAD = 24;
const RIGHT = SVG_WIDTH - PAD;
const MID = SVG_WIDTH / 2;
const LINE_H = 22;
const CONTENT_W = SVG_WIDTH - PAD * 2;
const COL_HALF = CONTENT_W / 2;
const LEFT_X = PAD;
const RIGHT_COL_X = PAD + COL_HALF;

/** Bill in không dấu — tránh lỗi font máy in. */
function r(value: string): string {
  return receiptAscii(value);
}

export type InvoicePdfData = {
  invoiceCode: string;
  householdCode: string;
  meterCode: string;
  residentName: string;
  address: string;
  periodLabel: string;
  periodMonth?: number;
  periodYear?: number;
  oldReading: number;
  newReading: number;
  usageM3: number;
  unitPrice: number;
  subtotalAmount: number;
  vatAmount: number;
  vatPercent?: number;
  totalAmount: number;
  transferNote?: string;
  paymentMethod?: string;
  /** VD: Liên 2 */
  copyLabel?: string;
  arrearsM3?: number;
  collectorName?: string;
  contactPhones?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Số trên bill: 1.534.286 */
function formatReceiptInt(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

function formatUsageM3(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  if (Number.isInteger(rounded)) return formatReceiptInt(rounded);
  return rounded.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

/** Đơn giá trên bill — giống app (số nguyên, dấu chấm nghìn). */
function formatReceiptUnitPrice(value: number): string {
  return formatReceiptInt(value);
}

function issuerName(): string {
  return r(
    process.env.INVOICE_ISSUER_NAME?.trim() ||
      "Hop tac xa thuy san va DV moi truong Tien Lang"
  );
}

function receiptDateTime(): string {
  const d = new Date();
  const date = d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wrapText(value: string, maxChars: number, maxLines = 4): string[] {
  const words = normalizeText(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > maxLines) return lines.slice(0, maxLines);
  return lines.length ? lines : ["-"];
}

function receiptText(
  x: number,
  y: number,
  text: string,
  opts: {
    size?: number;
    weight?: number;
    anchor?: "start" | "middle" | "end";
    fill?: string;
  } = {}
): string {
  const { size = 20, weight = 400, anchor = "start", fill = "#111" } = opts;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${RECEIPT_FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

type ReceiptLinesOpts = {
  maxChars: number;
  maxLines?: number;
  size?: number;
  weight?: number;
  lineHeight?: number;
  anchor?: "start" | "middle" | "end";
};

function receiptLines(
  x: number,
  y: number,
  text: string,
  opts: ReceiptLinesOpts
): { svg: string; height: number } {
  const {
    maxChars,
    maxLines = 4,
    size = 20,
    weight = 400,
    lineHeight = LINE_H,
    anchor = "start",
  } = opts;
  const lines = wrapText(text, maxChars, maxLines);
  const svg = lines
    .map((line, i) =>
      receiptText(x, y + i * lineHeight, line, { size, weight, anchor })
    )
    .join("");
  return { svg, height: Math.max(lines.length, 1) * lineHeight };
}

function dashedRule(y: number): string {
  return receiptText(MID, y, "--------------------------------", {
    size: 18,
    anchor: "middle",
    fill: "#333",
  });
}

function labelLine(y: number, label: string, value: string, x = PAD): string {
  return receiptText(x, y, `${label} ${value}`, { size: 20, weight: 400 });
}

function periodCopyLabel(data: InvoicePdfData): string {
  const copy = data.copyLabel?.trim() || process.env.INVOICE_COPY_LABEL?.trim() || "1";
  const month =
    data.periodMonth ??
    (Number(/\bT(\d{1,2})\b/i.exec(data.periodLabel)?.[1]) ||
      new Date().getMonth() + 1);
  return `T${month}(Lien ${copy})`;
}

function collectorLine(data: InvoicePdfData): string {
  const name =
    data.collectorName?.trim() ||
    process.env.INVOICE_COLLECTOR_NAME?.trim() ||
    "";
  return r(name);
}

function paymentMethodLabel(method: string | undefined): string {
  const m = method?.trim().toLowerCase() ?? "";
  if (m.includes("bank") || m.includes("chuyen")) return "Chuyen khoan";
  return "Tien mat";
}

function bankTransferFooter(
  y0: number,
  bank: ReturnType<typeof getReceiptBankTransferInfo>,
  qrUri: string | null
): { svg: string; height: number } {
  const leftMaxChars = Math.max(14, Math.floor(COL_HALF / 10));
  const parts: string[] = [];
  let leftY = y0;

  parts.push(receiptText(LEFT_X, leftY, "Chu tai khoan:", { size: 18 }));
  leftY += LINE_H;

  const holder = receiptLines(LEFT_X, leftY, bank.accountHolder, {
    maxChars: leftMaxChars,
    maxLines: 3,
    size: 18,
    lineHeight: LINE_H,
  });
  parts.push(holder.svg);
  leftY += holder.height;

  parts.push(receiptText(LEFT_X, leftY, "So tai khoan:", { size: 18 }));
  leftY += LINE_H;
  parts.push(
    receiptText(LEFT_X, leftY, bank.accountNumber, {
      size: 18,
      weight: 700,
    })
  );
  leftY += LINE_H;
  parts.push(
    receiptText(LEFT_X, leftY, `Ngan hang: ${bank.bankName}`, { size: 18 })
  );
  leftY += LINE_H;

  const leftHeight = leftY - y0;
  let blockHeight = leftHeight;

  if (qrUri) {
    const qrSize = receiptQrSideColumnSizePx(COL_HALF, LINE_H, leftHeight);
    const qrX = RIGHT_COL_X + (COL_HALF - qrSize) / 2;
    const qrY = y0 + Math.max(0, (leftHeight - qrSize) / 2);
    parts.push(
      `<image x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" href="${qrUri}" preserveAspectRatio="xMidYMid meet"/>`
    );
    blockHeight = Math.max(leftHeight, qrSize);
  }

  return { svg: parts.join(""), height: blockHeight };
}

function qrDataUri(buffer: Buffer | null): string | null {
  if (!buffer) return null;
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

function invoiceSvg(data: InvoicePdfData, qrUri: string | null): string {
  const subtotal = Math.round(data.subtotalAmount);
  const vatAmount = Math.round(data.vatAmount);
  const vatPercent = data.vatPercent ?? 0;
  const unitDisplay = receiptUnitPriceDisplay(
    data.unitPrice,
    data.usageM3,
    subtotal,
    vatPercent
  );
  const paymentMethod = paymentMethodLabel(data.paymentMethod);
  const arrears = data.arrearsM3 ?? 0;
  const parts: string[] = [];
  let y = 36;

  const push = (s: string) => parts.push(s);
  const gap = (n: number) => {
    y += n;
  };

  const issuer = receiptLines(MID, y, issuerName(), {
    maxChars: 32,
    maxLines: 3,
    size: 20,
    weight: 700,
    lineHeight: 24,
    anchor: "middle",
  });
  push(issuer.svg);
  y += issuer.height;
  gap(6);

  push(
    receiptText(MID, y, "BIEN NHAN THANH TOAN", {
      size: 22,
      weight: 700,
      anchor: "middle",
    })
  );
  gap(24);
  push(
    receiptText(MID, y, periodCopyLabel(data), {
      size: 20,
      weight: 700,
      anchor: "middle",
    })
  );
  gap(20);

  push(
    labelLine(
      y,
      "Ten KH:",
      r(
        displayResidentName(data.residentName, data.householdCode)
      ).toUpperCase()
    )
  );
  gap(LINE_H);
  push(labelLine(y, "Ma KH:", data.householdCode));
  gap(LINE_H);
  const addr = receiptLines(
    PAD,
    y,
    `Dia chi: ${formatReceiptAddress(data.address)}`,
    {
    maxChars: 34,
    maxLines: 4,
    size: 20,
    lineHeight: LINE_H,
  });
  push(addr.svg);
  y += addr.height;
  gap(8);

  push(labelLine(y, "NDK: NCK:", ""));
  gap(LINE_H);
  push(labelLine(y, "Hinh thuc TT:", paymentMethod));
  gap(LINE_H);
  push(labelLine(y, "Noi dung:", "Thanh toan tien nuoc"));
  gap(LINE_H);
  push(
    receiptText(
      PAD,
      y,
      `CS cu: ${formatReceiptInt(data.oldReading)}    CS moi: ${formatReceiptInt(data.newReading)}`,
      { size: 20 }
    )
  );
  gap(LINE_H);
  push(labelLine(y, "SL Truy thu:", formatReceiptInt(arrears)));
  gap(16);

  push(
    receiptText(MID, y, "SL(m3)  |  Don gia  |  Thanh tien", {
      size: 20,
      weight: 700,
      anchor: "middle",
    })
  );
  gap(LINE_H);
  push(
    receiptText(
      MID,
      y,
      `${formatUsageM3(data.usageM3)}  |  ${formatReceiptUnitPrice(unitDisplay)}  |  ${formatReceiptInt(subtotal)}`,
      { size: 20,
        weight: 700,
        anchor: "middle",
      }
    )
  );
  gap(16);
  push(dashedRule(y));
  gap(14);

  const showVatLine =
    vatAmount > 0 || (data.vatPercent != null && data.vatPercent > 0);
  if (showVatLine) {
    const vatLabel =
      data.vatPercent != null && data.vatPercent > 0
        ? `Thue GTGT (${data.vatPercent}%):`
        : "Thue GTGT:";
    push(receiptText(PAD, y, vatLabel, { size: 20 }));
    push(
      receiptText(RIGHT, y, formatReceiptInt(vatAmount), {
        size: 20,
        weight: 700,
        anchor: "end",
      })
    );
    gap(LINE_H);
  }
  push(receiptText(PAD, y, "Tong tien:", { size: 22, weight: 700 }));
  push(
    receiptText(RIGHT, y, formatReceiptInt(data.totalAmount), {
      size: 24,
      weight: 700,
      anchor: "end",
    })
  );
  gap(LINE_H);

  const words = r(amountInWordsVn(data.totalAmount));
  push(receiptText(PAD, y, "Bang chu:", { size: 20, weight: 700 }));
  gap(LINE_H);
  const wordsBlock = receiptLines(PAD, y, words, {
    maxChars: 34,
    maxLines: 3,
    size: 20,
    lineHeight: LINE_H,
  });
  push(wordsBlock.svg);
  y += wordsBlock.height;
  gap(12);
  push(dashedRule(y));
  gap(12);

  push(labelLine(y, "D/c:", ""));
  gap(LINE_H);

  const phones = data.contactPhones?.trim() || process.env.INVOICE_CONTACT_PHONES?.trim();
  if (phones) {
    push(labelLine(y, "LH:", phones));
    gap(LINE_H);
  }

  push(labelLine(y, "Ngay", receiptDateTime()));
  gap(LINE_H);

  const collector = collectorLine(data);
  if (collector) {
    push(labelLine(y, "NV thu:", collector));
    gap(LINE_H);
  }

  const bank = getReceiptBankTransferInfo();
  gap(12);
  push(dashedRule(y));
  gap(12);
  const bankBlock = bankTransferFooter(y, bank, qrUri);
  push(bankBlock.svg);
  y += bankBlock.height;

  const svgHeight = Math.ceil(y + 20);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${svgHeight}" viewBox="0 0 ${SVG_WIDTH} ${svgHeight}">
  <rect width="${SVG_WIDTH}" height="${svgHeight}" fill="#ffffff"/>
  <g>${parts.join("")}</g>
</svg>`;
}

function renderSvgToPng(svg: string): {
  png: Buffer;
  width: number;
  height: number;
} {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: fontFilePaths(),
      defaultFontFamily: "Roboto Mono",
      loadSystemFonts: false,
    },
    background: "white",
  });
  const rendered = resvg.render();
  return {
    png: Buffer.from(rendered.asPng()),
    width: rendered.width,
    height: rendered.height,
  };
}

function receiptSvgForData(data: InvoicePdfData): string {
  const qrBuffer = getReceiptBankQrBuffer();
  return invoiceSvg(data, qrBuffer ? receiptBankQrDataUri(qrBuffer) : null);
}

/** PNG xem trước bill (~80mm) — demo / kiểm tra layout không cần máy in. */
export async function renderReceiptPreviewPng(
  data: InvoicePdfData
): Promise<Buffer> {
  return renderSvgToPng(receiptSvgForData(data)).png;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const { png, width, height } = renderSvgToPng(receiptSvgForData(data));
  const pageH = (height / width) * RECEIPT_PT_WIDTH;

  const doc = await PDFDocument.create();
  const page = doc.addPage([RECEIPT_PT_WIDTH, pageH]);
  const image = await doc.embedPng(png);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: RECEIPT_PT_WIDTH,
    height: pageH,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
