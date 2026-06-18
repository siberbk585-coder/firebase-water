/**
 * Demo bill trên trình duyệt — không cần máy in.
 * Chạy: npm run demo:receipt
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  generateInvoicePdf,
  renderReceiptPreviewPng,
  type InvoicePdfData,
} from "../lib/pdf";

const OUT = join(process.cwd(), "storage", "demo");
mkdirSync(OUT, { recursive: true });

const sample: InvoicePdfData = {
  invoiceCode: "HD-202606-HH00001",
  householdCode: "BP1001",
  meterCode: "DH00001",
  residentName: "Nguyen Van A",
  address: "Thon Bac Phong, Kien Thiet",
  periodLabel: "Thang 6/2026",
  periodMonth: 6,
  periodYear: 2026,
  copyLabel: "2",
  oldReading: 7423,
  newReading: 7602,
  usageM3: 179,
  unitPrice: 9500,
  subtotalAmount: 1_622_619,
  vatAmount: 81_131,
  vatPercent: 5,
  totalAmount: 1_703_750,
  paymentMethod: "Tien mat",
  contactPhones: "0973065179 - 0335345620",
  collectorName: "Vu Thi Duyen",
  transferNote: "DH00001 T6-2026",
};

const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Demo biên nhận — Tiên Lãng</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 100%);
      font-family: system-ui, -apple-system, sans-serif;
      color: #e2e8f0;
      padding: 24px 16px 48px;
    }
    .wrap { max-width: 420px; margin: 0 auto; }
    h1 { font-size: 1.15rem; font-weight: 700; margin: 0 0 4px; }
    .sub { font-size: 0.85rem; color: #94a3b8; margin-bottom: 20px; }
    .paper {
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 20px 50px rgba(0,0,0,.45);
      padding: 8px 4px 12px;
    }
    .paper img { display: block; width: 100%; height: auto; }
    .note {
      margin-top: 16px;
      font-size: 0.8rem;
      color: #94a3b8;
      line-height: 1.5;
    }
    .actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
    .actions a {
      flex: 1;
      min-width: 140px;
      text-align: center;
      padding: 10px 14px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .btn-pdf { background: #0d9488; color: #fff; }
    .btn-png { background: #334155; color: #f1f5f9; border: 1px solid #475569; }
    .badge {
      display: inline-block;
      background: #0369a1;
      color: #fff;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 999px;
      margin-left: 8px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Demo biên nhận in nhiệt <span class="badge">mẫu</span></h1>
    <p class="sub">Không dấu · QR Agribank · CK trái / QR phải (50/50)</p>
    <div class="paper">
      <img src="bill-demo.png" alt="Mẫu biên nhận"/>
    </div>
    <div class="actions">
      <a class="btn-pdf" href="bill-demo.pdf" target="_blank">Mở PDF</a>
      <a class="btn-png" href="bill-demo.png" target="_blank">Ảnh PNG</a>
    </div>
    <p class="note">
      Render giống bill web &amp; app APK 1.0.2 (Bluetooth). Chưa deploy web thì admin in PDF cũ;
      app chưa cập nhật vẫn bill cũ.
    </p>
  </div>
</body>
</html>`;

async function main() {
  const [png, pdf] = await Promise.all([
    renderReceiptPreviewPng(sample),
    generateInvoicePdf(sample),
  ]);

  writeFileSync(join(OUT, "bill-demo.png"), png);
  writeFileSync(join(OUT, "bill-demo.pdf"), pdf);
  writeFileSync(join(OUT, "index.html"), html);

  console.log(join(OUT, "index.html"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
