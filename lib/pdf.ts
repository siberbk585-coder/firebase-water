import { PDFDocument } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import { join } from "path";
import { amountInWordsVn } from "./amountInWords";
import { fetchPaymentQrImage } from "./paymentQr";

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
const LINE_H = 26;

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

function issuerName(): string {
  return (
    process.env.INVOICE_ISSUER_NAME?.trim() ||
    "Hợp tác xã thủy sản và dịch vụ môi trường Tiên Lãng"
  );
}

function receiptDateTime(): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
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

function receiptLines(
  x: number,
  y: number,
  text: string,
  maxChars: number,
  maxLines: number,
  size = 20,
  weight = 400,
  lineHeight = LINE_H
): { svg: string; height: number } {
  const lines = wrapText(text, maxChars, maxLines);
  const svg = lines
    .map((line, i) => receiptText(x, y + i * lineHeight, line, { size, weight }))
    .join("");
  return { svg, height: lines.length * lineHeight };
}

function dashedRule(y: number): string {
  return receiptText(MID, y, "--------------------------------", {
    size: 18,
    anchor: "middle",
    fill: "#333",
  });
}

function labelLine(y: number, label: string, value: string): string {
  return receiptText(PAD, y, `${label} ${value}`, { size: 20, weight: 400 });
}

function vatBreakdown(totalAmount: number): { subtotal: number; vatAmount: number } {
  const rate = Number(process.env.INVOICE_VAT_RATE ?? 0);
  if (!rate || rate <= 0) {
    return { subtotal: Math.round(totalAmount), vatAmount: 0 };
  }
  const subtotal = Math.round(totalAmount / (1 + rate));
  return { subtotal, vatAmount: Math.round(totalAmount) - subtotal };
}

function periodCopyLabel(data: InvoicePdfData): string {
  const copy = data.copyLabel?.trim() || process.env.INVOICE_COPY_LABEL?.trim() || "1";
  const month =
    data.periodMonth ??
    (Number(/\bT(\d{1,2})\b/i.exec(data.periodLabel)?.[1]) ||
      new Date().getMonth() + 1);
  return `T${month}(Liên ${copy})`;
}

function collectorLine(data: InvoicePdfData): string {
  return (
    data.collectorName?.trim() ||
    process.env.INVOICE_COLLECTOR_NAME?.trim() ||
    ""
  );
}

function qrDataUri(buffer: Buffer | null): string | null {
  if (!buffer) return null;
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

function invoiceSvg(data: InvoicePdfData, qrUri: string | null): string {
  const { subtotal, vatAmount } = vatBreakdown(data.totalAmount);
  const paymentMethod = data.paymentMethod?.trim() || "Tiền mặt";
  const arrears = data.arrearsM3 ?? 0;
  const parts: string[] = [];
  let y = 36;

  const push = (s: string) => parts.push(s);
  const gap = (n: number) => {
    y += n;
  };

  const issuer = receiptLines(MID, y, issuerName(), 38, 3, 22, 700, 28);
  push(issuer.svg);
  y += issuer.height;
  gap(8);

  push(
    receiptText(MID, y, "BIÊN NHẬN THANH TOÁN", {
      size: 24,
      weight: 700,
      anchor: "middle",
    })
  );
  gap(28);
  push(
    receiptText(MID, y, periodCopyLabel(data), {
      size: 22,
      weight: 700,
      anchor: "middle",
    })
  );
  gap(32);

  push(labelLine(y, "Tên KH:", data.residentName.toUpperCase()));
  gap(LINE_H);
  push(labelLine(y, "Mã KH:", data.householdCode));
  gap(LINE_H);
  const addr = receiptLines(PAD, y, `Địa chỉ: ${data.address || "-"}`, 36, 3, 22, 20, 400);
  push(addr.svg);
  y += addr.height;
  gap(20);

  push(labelLine(y, "NĐK: NCK:", ""));
  gap(LINE_H);
  push(labelLine(y, "Hình thức TT:", paymentMethod));
  gap(LINE_H);
  push(labelLine(y, "Nội dung:", "Thanh toán tiền nước"));
  gap(LINE_H);
  push(
    receiptText(
      PAD,
      y,
      `CS cũ: ${formatReceiptInt(data.oldReading)}    CS mới: ${formatReceiptInt(data.newReading)}`,
      { size: 20 }
    )
  );
  gap(LINE_H);
  push(labelLine(y, "SL Truy thu:", formatReceiptInt(arrears)));
  gap(28);

  push(
    receiptText(MID, y, "SL(m³)  |  Đơn giá  |  Thành tiền", {
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
      `${formatUsageM3(data.usageM3)}  |  ${formatReceiptInt(data.unitPrice)}  |  ${formatReceiptInt(subtotal)}`,
      { size: 20,
        weight: 700,
        anchor: "middle",
      }
    )
  );
  gap(28);
  push(dashedRule(y));
  gap(24);

  push(receiptText(PAD, y, "Thuế GTGT:", { size: 20 }));
  push(
    receiptText(RIGHT, y, formatReceiptInt(vatAmount), {
      size: 20,
      weight: 700,
      anchor: "end",
    })
  );
  gap(LINE_H);
  push(receiptText(PAD, y, "Tổng tiền:", { size: 22, weight: 700 }));
  push(
    receiptText(RIGHT, y, formatReceiptInt(data.totalAmount), {
      size: 24,
      weight: 700,
      anchor: "end",
    })
  );
  gap(LINE_H);

  const words = amountInWordsVn(data.totalAmount);
  push(receiptText(PAD, y, "Bằng chữ:", { size: 20, weight: 700 }));
  gap(22);
  const wordsBlock = receiptLines(PAD, y, words, 36, 4, 22, 20, 400);
  push(wordsBlock.svg);
  y += wordsBlock.height;
  gap(24);
  push(dashedRule(y));
  gap(24);

  const phones = data.contactPhones?.trim() || process.env.INVOICE_CONTACT_PHONES?.trim();
  if (phones) {
    push(labelLine(y, "LH:", phones));
    gap(LINE_H);
  }

  push(labelLine(y, "Ngày", receiptDateTime()));
  gap(LINE_H);

  const collector = collectorLine(data);
  if (collector) {
    push(labelLine(y, "NV thu:", collector));
    gap(LINE_H);
  }

  if (qrUri && process.env.INVOICE_RECEIPT_QR !== "false") {
    gap(12);
    const qrSize = 140;
    push(
      `<image x="${(SVG_WIDTH - qrSize) / 2}" y="${y}" width="${qrSize}" height="${qrSize}" href="${qrUri}" preserveAspectRatio="xMidYMid meet"/>`
    );
    y += qrSize + 12;
  }

  const svgHeight = Math.ceil(y + 20);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${svgHeight}" viewBox="0 0 ${SVG_WIDTH} ${svgHeight}">
  <rect width="${SVG_WIDTH}" height="${svgHeight}" fill="#ffffff"/>
  <g>${parts.join("")}</g>
</svg>`;
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const transferNote = data.transferNote || `${data.meterCode} ${data.periodLabel}`;
  const qrBuffer = await fetchPaymentQrImage({
    amount: data.totalAmount,
    addInfo: transferNote,
  });
  const svg = invoiceSvg(data, qrDataUri(qrBuffer));
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: fontFilePaths(),
      defaultFontFamily: "Roboto Mono",
      loadSystemFonts: false,
    },
    background: "white",
  });
  const rendered = resvg.render();
  const png = Buffer.from(rendered.asPng());
  const imgW = rendered.width;
  const imgH = rendered.height;
  const pageH = (imgH / imgW) * RECEIPT_PT_WIDTH;

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
