import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBillingAmounts,
  receiptUnitPriceDisplay,
  resolveInvoiceAmounts,
  splitVatInclusiveTotal,
  unitPriceExclusiveFromInclusive,
} from "../lib/vat";

test("calculateBillingAmounts: đơn giá đã gồm VAT, thành tiền không đổi", () => {
  const a = calculateBillingAmounts(10, 9500, 5);
  assert.equal(a.totalAmount, 95_000);
  assert.equal(a.subtotal + a.vatAmount, a.totalAmount);
  assert.equal(a.vatPercent, 5);
});

test("splitVatInclusiveTotal: 120.000 đ gồm 5% VAT", () => {
  const a = splitVatInclusiveTotal(120_000, 5);
  assert.equal(a.subtotal, 114_286);
  assert.equal(a.vatAmount, 5_714);
  assert.equal(a.totalAmount, 120_000);
});

test("unitPriceExclusiveFromInclusive: 9.500 gồm 5% → ~9.048", () => {
  assert.equal(unitPriceExclusiveFromInclusive(9_500, 5), 9_048);
});

test("receiptUnitPriceDisplay: đơn giá in ~9.048, dòng tiền = giá trước thuế", () => {
  const amounts = calculateBillingAmounts(2, 9_500, 5);
  assert.equal(amounts.subtotal, 18_095);
  assert.equal(amounts.totalAmount, 19_000);
  assert.equal(receiptUnitPriceDisplay(9_500, 2, amounts.subtotal, 5), 9_048);
});

test("resolveInvoiceAmounts tách GTGT không tăng thành tiền", () => {
  const fixed = resolveInvoiceAmounts(
    {
      usageM3: 8,
      unitPrice: 15_000,
      subtotalAmount: 120_000,
      vatPercent: 0,
      vatAmount: 0,
      totalAmount: 120_000,
    },
    5
  );
  assert.equal(fixed.totalAmount, 120_000);
  assert.equal(fixed.vatPercent, 5);
  assert.equal(fixed.subtotal + fixed.vatAmount, 120_000);
});
