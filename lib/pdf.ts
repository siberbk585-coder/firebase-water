import { PDFDocument } from "pdf-lib";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "fs";
import { join } from "path";
import { fetchPaymentQrImage } from "./paymentQr";

const FONT_WEIGHTS = [500, 600, 700, 800, 900] as const;
const FONT_BASE = join(
  process.cwd(),
  "node_modules/@fontsource/be-vietnam-pro/files"
);
/** TTF font files for resvg server-side rendering (in public/fonts/). */
const TTF_BASE = join(process.cwd(), "public/fonts");
const TTF_FILES: Record<number, string> = {
  500: "BeVietnamPro-Medium.ttf",
  600: "BeVietnamPro-SemiBold.ttf",
  700: "BeVietnamPro-Bold.ttf",
  800: "BeVietnamPro-ExtraBold.ttf",
  900: "BeVietnamPro-Black.ttf",
};

/** Load TTF font buffers for resvg (resvg cần TTF, không phải woff). */
let _fontBuffers: Buffer[] | null = null;
function fontBuffers(): Buffer[] {
  if (_fontBuffers) return _fontBuffers;
  const bufs: Buffer[] = [];
  for (const weight of FONT_WEIGHTS) {
    const file = TTF_FILES[weight];
    try {
      bufs.push(readFileSync(join(TTF_BASE, file)));
    } catch (e) {
      console.warn(`[pdf] Missing font file: ${file}`, e);
    }
  }
  _fontBuffers = bufs;
  return bufs;
}

function loadFontFaceCSS(): string {
  const subsets = ["latin", "vietnamese"] as const;
  const faces: string[] = [];
  for (const subset of subsets) {
    for (const weight of FONT_WEIGHTS) {
      const path = join(
        FONT_BASE,
        `be-vietnam-pro-${subset}-${weight}-normal.woff`
      );
      let b64: string;
      try {
        b64 = readFileSync(path).toString("base64");
      } catch {
        continue;
      }
      faces.push(
        `@font-face { font-family: 'BVP'; font-weight: ${weight}; font-style: normal; src: url('data:font/woff;base64,${b64}') format('woff'); unicode-range: ${subset === "vietnamese" ? "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+1EA0-1EF9,U+20AB" : "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"}; }`
      );
    }
  }
  return faces.join("\n      ");
}

let _fontFaceCSS: string | null = null;
function fontFaceCSS(): string {
  if (!_fontFaceCSS) _fontFaceCSS = loadFontFaceCSS();
  return _fontFaceCSS;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const SVG_WIDTH = 1240;
const SVG_HEIGHT = 1754;

export type InvoicePdfData = {
  invoiceCode: string;
  householdCode: string;
  meterCode: string;
  residentName: string;
  address: string;
  periodLabel: string;
  oldReading: number;
  newReading: number;
  usageM3: number;
  unitPrice: number;
  totalAmount: number;
  transferNote?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

function issuerName(): string {
  return process.env.INVOICE_ISSUER_NAME?.trim() || "BAN QUẢN LÝ THU TIỀN NƯỚC";
}

function invoiceDate(): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function wrapText(value: string, maxChars: number, maxLines = 2): string[] {
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

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  const usedWords = lines.join(" ").split(" ").filter(Boolean).length;
  if (usedWords < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\.+$/, "")}...`;
  }

  return lines.length ? lines : ["-"];
}

function textLines({
  text,
  x,
  y,
  maxChars,
  maxLines,
  size = 28,
  weight = 500,
  fill = "#172033",
  lineHeight = Math.round(size * 1.35),
}: {
  text: string;
  x: number;
  y: number;
  maxChars: number;
  maxLines?: number;
  size?: number;
  weight?: number;
  fill?: string;
  lineHeight?: number;
}): string {
  return wrapText(text, maxChars, maxLines)
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" font-family="'Be Vietnam Pro', Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`
    )
    .join("");
}

function bankInfo(): { accountNo?: string; accountName?: string } {
  return {
    accountNo: process.env.BANK_ACCOUNT?.trim(),
    accountName: process.env.BANK_ACCOUNT_NAME?.trim(),
  };
}

function qrDataUri(buffer: Buffer | null): string | null {
  if (!buffer) return null;
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

function invoiceSvg(data: InvoicePdfData, qrUri: string | null): string {
  const transferNote = data.transferNote || `${data.meterCode} ${data.periodLabel}`;
  const bank = bankInfo();
  const oldReading = formatNumber(data.oldReading);
  const newReading = formatNumber(data.newReading);
  const usage = formatNumber(data.usageM3);
  const unitPrice = formatMoney(data.unitPrice);
  const total = formatMoney(data.totalAmount);
  const subtotalLabel = `${usage} m³ x ${unitPrice}`;

  const qrBlock = qrUri
    ? `<rect x="842" y="1248" width="252" height="252" rx="18" fill="#ffffff" stroke="#d9e4e2" stroke-width="2"/>
       <image x="858" y="1264" width="220" height="220" href="${qrUri}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="842" y="1248" width="252" height="252" rx="18" fill="#f4faf8" stroke="#d9e4e2" stroke-width="2"/>
       <text x="968" y="1354" text-anchor="middle" font-size="28" font-weight="700" fill="#0f766e">QR</text>
       <text x="968" y="1396" text-anchor="middle" font-size="18" fill="#64748b">Chưa cấu hình VietQR</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">
  <defs>
    <style>
      ${fontFaceCSS()}
      .font { font-family: 'Be Vietnam Pro', Arial, sans-serif; }
      .muted { fill: #64748b; font-family: 'Be Vietnam Pro', Arial, sans-serif; }
      .label { fill: #64748b; font-family: 'Be Vietnam Pro', Arial, sans-serif; font-size: 22px; font-weight: 700; letter-spacing: .08em; }
      .value { fill: #172033; font-family: 'Be Vietnam Pro', Arial, sans-serif; font-size: 30px; font-weight: 700; }
      .body { fill: #334155; font-family: 'Be Vietnam Pro', Arial, sans-serif; font-size: 26px; font-weight: 500; }
      .small { fill: #64748b; font-family: 'Be Vietnam Pro', Arial, sans-serif; font-size: 20px; font-weight: 500; }
      .tableHead { fill: #0f766e; font-family: 'Be Vietnam Pro', Arial, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: .04em; }
      .tableCell { fill: #172033; font-family: 'Be Vietnam Pro', Arial, sans-serif; font-size: 26px; font-weight: 600; }
    </style>
  </defs>

  <rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#f7fbfa"/>
  <rect x="64" y="58" width="1112" height="1638" rx="28" fill="#ffffff" stroke="#d9e4e2" stroke-width="2"/>
  <rect x="64" y="58" width="1112" height="178" rx="28" fill="#0f766e"/>
  <rect x="64" y="190" width="1112" height="46" fill="#0f766e"/>

  <g class="font">
    <circle cx="128" cy="134" r="32" fill="#ccfbf1"/>
    <path d="M112 132 C120 106 144 106 152 132 C158 153 140 164 132 164 C124 164 106 153 112 132Z" fill="#0f766e"/>
    <text x="184" y="116" font-size="24" font-weight="800" fill="#ccfbf1" letter-spacing=".08em">${escapeXml(issuerName())}</text>
    <text x="184" y="164" font-size="44" font-weight="900" fill="#ffffff">HÓA ĐƠN TIỀN NƯỚC</text>
    <text x="862" y="121" font-size="22" font-weight="700" fill="#ccfbf1">Mã hóa đơn</text>
    <text x="862" y="163" font-size="30" font-weight="900" fill="#ffffff">${escapeXml(data.invoiceCode)}</text>

    <text x="88" y="288" class="label">THÔNG TIN HỘ DÂN</text>
    <text x="660" y="288" class="label">THÔNG TIN KỲ THU</text>

    <rect x="88" y="318" width="500" height="274" rx="22" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
    <text x="122" y="374" class="small">Chủ hộ</text>
    ${textLines({ text: data.residentName, x: 122, y: 420, maxChars: 26, maxLines: 2, size: 34, weight: 800 })}
    <text x="122" y="500" class="small">Mã hộ / Mã đồng hồ</text>
    <text x="122" y="542" class="body">${escapeXml(data.householdCode)} · ${escapeXml(data.meterCode)}</text>

    <rect x="620" y="318" width="532" height="274" rx="22" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
    <text x="654" y="374" class="small">Kỳ tính tiền</text>
    <text x="654" y="420" class="value">${escapeXml(data.periodLabel)}</text>
    <text x="654" y="484" class="small">Ngày lập</text>
    <text x="654" y="526" class="body">${invoiceDate()}</text>

    <text x="88" y="650" class="label">ĐỊA CHỈ</text>
    <rect x="88" y="680" width="1064" height="116" rx="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    ${textLines({ text: data.address || "-", x: 122, y: 735, maxChars: 72, maxLines: 2, size: 27, weight: 600, fill: "#334155" })}

    <text x="88" y="874" class="label">CHI TIẾT TÍNH TIỀN</text>
    <rect x="88" y="904" width="1064" height="300" rx="22" fill="#ffffff" stroke="#d9e4e2" stroke-width="2"/>
    <rect x="88" y="904" width="1064" height="68" rx="22" fill="#e6f7f4"/>
    <rect x="88" y="950" width="1064" height="22" fill="#e6f7f4"/>
    <text x="122" y="948" class="tableHead">Nội dung</text>
    <text x="646" y="948" class="tableHead">Đơn vị</text>
    <text x="842" y="948" text-anchor="middle" class="tableHead">Số lượng</text>
    <text x="1120" y="948" text-anchor="end" class="tableHead">Thành tiền</text>

    <line x1="88" y1="1048" x2="1152" y2="1048" stroke="#e2e8f0" stroke-width="2"/>
    <line x1="88" y1="1126" x2="1152" y2="1126" stroke="#e2e8f0" stroke-width="2"/>
    <text x="122" y="1018" class="tableCell">Chỉ số cũ (CSC)</text>
    <text x="646" y="1018" class="body">m³</text>
    <text x="842" y="1018" text-anchor="middle" class="tableCell">${escapeXml(oldReading)}</text>
    <text x="1120" y="1018" text-anchor="end" class="muted" font-size="24">-</text>

    <text x="122" y="1096" class="tableCell">Chỉ số mới (CSM)</text>
    <text x="646" y="1096" class="body">m³</text>
    <text x="842" y="1096" text-anchor="middle" class="tableCell">${escapeXml(newReading)}</text>
    <text x="1120" y="1096" text-anchor="end" class="muted" font-size="24">-</text>

    <text x="122" y="1174" class="tableCell">${escapeXml(subtotalLabel)}</text>
    <text x="646" y="1174" class="body">m³</text>
    <text x="842" y="1174" text-anchor="middle" class="tableCell">${escapeXml(usage)}</text>
    <text x="1120" y="1174" text-anchor="end" class="tableCell">${escapeXml(total)}</text>

    <rect x="88" y="1256" width="688" height="178" rx="24" fill="#f0fdfa" stroke="#99f6e4" stroke-width="2"/>
    <text x="122" y="1312" font-size="24" font-weight="800" fill="#0f766e">TỔNG CỘNG PHẢI THU</text>
    <text x="122" y="1382" font-size="58" font-weight="900" fill="#115e59">${escapeXml(total)}</text>

    <text x="88" y="1500" class="label">THANH TOÁN</text>
    <rect x="88" y="1530" width="1064" height="118" rx="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <text x="122" y="1584" class="body">Nội dung CK: <tspan font-weight="900" fill="#0f766e">${escapeXml(transferNote)}</tspan></text>
    <text x="122" y="1628" class="small">${escapeXml(bank.accountNo ? `Số TK: ${bank.accountNo}${bank.accountName ? ` - ${bank.accountName}` : ""}` : "Có thể thanh toán tiền mặt tại văn phòng ban quản lý.")}</text>

    ${qrBlock}
    <text x="88" y="1680" class="small">Hóa đơn điện tử dùng để đối chiếu thu tiền nước. Vui lòng giữ lại sau khi thanh toán.</text>
  </g>
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
      fontBuffers: fontBuffers(),
      defaultFontFamily: "Be Vietnam Pro",
      loadSystemFonts: false,
    },
    background: "white",
  });
  const png = Buffer.from(resvg.render().asPng());

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const image = await doc.embedPng(png);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
