#!/usr/bin/env node
/**
 * Test webhook Hoadon — chạy: node scripts/test-hoadon-webhook.mjs
 * Cần file PDF thật (mặc định tạo /tmp/test-invoice.pdf nếu chưa có).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";

const WEBHOOK = process.env.N8N_INVOICE_WEBHOOK_URL?.trim();
if (!WEBHOOK) {
  console.error("Thiếu N8N_INVOICE_WEBHOOK_URL — set biến môi trường trước khi chạy test.");
  process.exit(1);
}

const pdfPath = process.argv[2] || "/tmp/test-invoice.pdf";
if (!existsSync(pdfPath)) {
  writeFileSync(
    pdfPath,
    Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")
  );
  console.log("Đã tạo PDF mẫu:", pdfPath);
}

const buf = readFileSync(pdfPath);
const form = new FormData();
form.append("pdf", new Blob([buf], { type: "application/pdf" }), "test_invoice.pdf");
form.append("householdCode", "HH00001");
form.append("invoiceId", `test-${Date.now()}`);
form.append("source", "firebase-water-test");

console.log("POST", WEBHOOK);
const res = await fetch(WEBHOOK, { method: "POST", body: form });
const text = await res.text();
console.log("HTTP", res.status);
console.log(text.slice(0, 500));

if (!res.ok) {
  console.error("\n→ Workflow n8n lỗi: mở Executions trên n8n, sửa node Drive/binary.");
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = text;
}

const findUrl = (data) => {
  if (!data) return null;
  if (typeof data === "string" && /^https?:/i.test(data)) return data;
  if (Array.isArray(data)) {
    for (const x of data) {
      const u = findUrl(x);
      if (u) return u;
    }
  }
  if (typeof data === "object") {
    for (const k of ["webContentLink", "url", "pdfUrl"]) {
      if (typeof data[k] === "string" && /^https?:/i.test(data[k])) return data[k];
    }
  }
  return null;
};

const url = findUrl(parsed);
if (url) {
  console.log("\n✓ Link Drive:", url);
} else {
  console.error("\n✗ Không thấy url/webContentLink trong response — sửa node Respond trên n8n.");
  process.exit(1);
}
