import assert from "node:assert/strict";
import test from "node:test";
import { calculateBillingAmounts, resolveInvoiceAmounts } from "../lib/vat";

test("calculateBillingAmounts: gia + GTGT = thanh tien", () => {
  const a = calculateBillingAmounts(179, 8571, 10);
  assert.equal(a.subtotal, 1_534_209);
  assert.equal(a.vatAmount, 153_421);
  assert.equal(a.totalAmount, a.subtotal + a.vatAmount);
});

test("resolveInvoiceAmounts backfills legacy invoice without VAT", () => {
  const fixed = resolveInvoiceAmounts(
    {
      usageM3: 8,
      unitPrice: 15_000,
      subtotalAmount: 120_000,
      vatPercent: 0,
      vatAmount: 0,
      totalAmount: 120_000,
    },
    10
  );
  assert.equal(fixed.subtotal, 120_000);
  assert.equal(fixed.vatAmount, 12_000);
  assert.equal(fixed.totalAmount, 132_000);
});
