/** Đọc số tiền (VND) thành chữ — dùng trên biên nhận in nhiệt. */
const UNITS = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const SCALES = ["", "nghìn", "triệu", "tỷ"];

function readTriple(n: number, isLeadingChunk: boolean): string {
  const hundred = Math.floor(n / 100);
  const ten = Math.floor((n % 100) / 10);
  const one = n % 10;
  const parts: string[] = [];

  if (hundred > 0) {
    parts.push(`${UNITS[hundred]} trăm`);
  } else if (!isLeadingChunk && ten > 0) {
    parts.push("không trăm");
  }

  if (ten > 1) {
    parts.push(`${UNITS[ten]} mươi`);
    if (one === 1) parts.push("mốt");
    else if (one === 5) parts.push("lăm");
    else if (one > 0) parts.push(UNITS[one]);
  } else if (ten === 1) {
    parts.push("mười");
    if (one === 5) parts.push("lăm");
    else if (one > 0) parts.push(UNITS[one]);
  } else if (ten === 0 && one > 0) {
    if (!isLeadingChunk && hundred === 0) parts.push("lẻ");
    if (one === 5) parts.push("lăm");
    else parts.push(UNITS[one]);
  }

  return parts.join(" ").trim();
}

function readNumber(n: number): string {
  if (n === 0) return "không";
  if (n < 0) return `âm ${readNumber(-n)}`;

  const triples: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    triples.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  let leadingIndex = triples.length - 1;
  while (leadingIndex > 0 && triples[leadingIndex] === 0) leadingIndex--;

  const chunks: string[] = [];
  for (let scale = triples.length - 1; scale >= 0; scale--) {
    const triple = triples[scale];
    if (triple === 0) continue;
    const words = readTriple(triple, scale === leadingIndex);
    const scaleWord = SCALES[scale];
    chunks.push(scaleWord ? `${words} ${scaleWord}` : words);
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export function amountInWordsVn(amount: number): string {
  const n = Math.round(amount);
  if (!Number.isFinite(n) || n < 0) return "";
  return readNumber(n);
}
