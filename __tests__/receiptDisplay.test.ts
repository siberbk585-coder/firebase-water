import assert from "node:assert/strict";
import test from "node:test";
import {
  formatReceiptAddress,
  getReceiptBankTransferInfo,
  receiptAscii,
  RECEIPT_ADDRESS_SUFFIX,
  RECEIPT_BANK_ACCOUNT_HOLDER,
  RECEIPT_BANK_ACCOUNT_NUMBER,
  RECEIPT_BANK_NAME,
} from "../lib/receiptDisplay";

test("formatReceiptAddress appends commune/city suffix", () => {
  assert.equal(
    formatReceiptAddress("Bac Phong, Kien Thiet"),
    `Bac Phong, Kien Thiet, ${RECEIPT_ADDRESS_SUFFIX}`
  );
});

test("receiptAscii strips Vietnamese diacritics", () => {
  assert.equal(
    receiptAscii("Hợp tác xã thủy sản"),
    "Hop tac xa thuy san"
  );
});

test("formatReceiptAddress uses suffix alone when address empty", () => {
  assert.equal(formatReceiptAddress(""), RECEIPT_ADDRESS_SUFFIX);
  assert.equal(formatReceiptAddress("-"), RECEIPT_ADDRESS_SUFFIX);
  assert.equal(formatReceiptAddress(null, "  "), RECEIPT_ADDRESS_SUFFIX);
});

test("formatReceiptAddress does not duplicate suffix", () => {
  const full = `Thon 1, ${RECEIPT_ADDRESS_SUFFIX}`;
  assert.equal(formatReceiptAddress(full), full);
});

test("formatReceiptAddress falls back to route name", () => {
  assert.equal(
    formatReceiptAddress(null, "Duong 212"),
    `Duong 212, ${RECEIPT_ADDRESS_SUFFIX}`
  );
});

test("getReceiptBankTransferInfo uses Agribank defaults", () => {
  const bank = getReceiptBankTransferInfo();
  assert.equal(bank.accountHolder, RECEIPT_BANK_ACCOUNT_HOLDER);
  assert.equal(bank.accountNumber, RECEIPT_BANK_ACCOUNT_NUMBER);
  assert.equal(bank.bankName, RECEIPT_BANK_NAME);
});
