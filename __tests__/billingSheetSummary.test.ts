import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeBillingSheetMoney } from "../lib/billingSheetSummary";
import { InvoiceStatus, ReadingStatus } from "../lib/types/enums";

describe("summarizeBillingSheetMoney", () => {
  it("sums paid and unpaid amounts for collector summary", () => {
    const rows = [
      {
        householdId: "h1",
        paid: true,
        status: ReadingStatus.CONFIRMED,
        invoiceStatus: InvoiceStatus.PAID,
        totalAmount: 100_000,
        usageM3: 10,
        unitPrice: 10_000,
        subtotalAmount: null,
        vatAmount: null,
        vatPercent: null,
      },
      {
        householdId: "h2",
        paid: false,
        status: ReadingStatus.CONFIRMED,
        invoiceStatus: InvoiceStatus.ISSUED,
        totalAmount: 50_000,
        usageM3: 5,
        unitPrice: 10_000,
        subtotalAmount: null,
        vatAmount: null,
        vatPercent: null,
      },
      {
        householdId: "h3",
        paid: false,
        status: ReadingStatus.PENDING,
        invoiceStatus: null,
        totalAmount: null,
        usageM3: null,
        unitPrice: 10_000,
        subtotalAmount: null,
        vatAmount: null,
        vatPercent: null,
      },
    ] as Parameters<typeof summarizeBillingSheetMoney>[0];

    const s = summarizeBillingSheetMoney(rows, 5);
    assert.equal(s.totalHouseholds, 3);
    assert.equal(s.paidHouseholds, 1);
    assert.equal(s.unpaidHouseholds, 1);
    assert.equal(s.paidAmount, 100_000);
    assert.equal(s.unpaidAmount, 50_000);
  });
});
