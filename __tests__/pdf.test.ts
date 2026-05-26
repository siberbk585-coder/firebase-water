import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { amountInWordsVn } from "../lib/amountInWords";
import { generateInvoicePdf } from "../lib/pdf";

test("amountInWordsVn reads VND amounts", () => {
  assert.equal(
    amountInWordsVn(1_611_000),
    "một triệu sáu trăm mười một nghìn"
  );
  assert.equal(amountInWordsVn(0), "không");
});

test("generateInvoicePdf returns a readable one-page receipt PDF", async () => {
  const pdf = await generateInvoicePdf({
    invoiceCode: "HD-202605-HH00001",
    householdCode: "BP1001",
    meterCode: "DH00001",
    residentName: "TRƯỜNG TIỂU HỌC LIÊN PHONG",
    address: "Bắc Phong, Kiến Thiết, Tiên Lãng, Hải Phòng",
    periodLabel: "Tháng 5/2026",
    periodMonth: 5,
    periodYear: 2026,
    copyLabel: "2",
    oldReading: 7423,
    newReading: 7602,
    usageM3: 179,
    unitPrice: 8571,
    totalAmount: 1_611_000,
    paymentMethod: "Tiền mặt",
    contactPhones: "0973065179 - 0335345620",
    collectorName: "Vũ Thị Duyên",
    transferNote: "DH00001 T5-2026",
  });

  assert.equal(pdf.subarray(0, 5).toString("utf8"), "%PDF-");
  assert.ok(pdf.length > 5_000);

  const doc = await PDFDocument.load(pdf);
  assert.equal(doc.getPageCount(), 1);
});
