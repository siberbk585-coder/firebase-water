import assert from "node:assert/strict";
import test from "node:test";
import {
  getReceiptBankQrBuffer,
  receiptQrMaxHeightPx,
  receiptQrSideColumnSizePx,
  RECEIPT_QR_MAX_LINES,
  RECEIPT_QR_MIN_LINES,
  RECEIPT_QR_SIZE_SCALE,
} from "../lib/receiptQr";

test("receiptQrMaxHeightPx caps QR to line count", () => {
  assert.equal(receiptQrMaxHeightPx(22), 22 * RECEIPT_QR_MAX_LINES);
});

test("receiptQrSideColumnSizePx matches left block height +10%", () => {
  assert.equal(
    receiptQrSideColumnSizePx(256, 22, 132),
    Math.round(132 * RECEIPT_QR_SIZE_SCALE)
  );
});

test("receiptQrSideColumnSizePx enforces minimum lines", () => {
  assert.equal(
    receiptQrSideColumnSizePx(256, 22, 60),
    Math.round(22 * RECEIPT_QR_MIN_LINES * RECEIPT_QR_SIZE_SCALE)
  );
});

test("receiptQrSideColumnSizePx respects column width", () => {
  assert.equal(receiptQrSideColumnSizePx(100, 22, 200), 88);
});

test("getReceiptBankQrBuffer loads bundled Agribank QR", () => {
  const buf = getReceiptBankQrBuffer();
  assert.ok(buf);
  assert.ok(buf!.length > 1_000);
});
