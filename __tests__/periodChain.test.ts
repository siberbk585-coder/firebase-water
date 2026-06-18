import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { calendarPriorPeriod, assertPriorPeriodReadingConfirmed } from "../lib/periodChain";

describe("periodChain", () => {
  it("calendarPriorPeriod — tháng liền kề", () => {
    assert.deepEqual(calendarPriorPeriod(2026, 5), { year: 2026, month: 4 });
    assert.deepEqual(calendarPriorPeriod(2026, 1), { year: 2025, month: 12 });
  });

  it("bỏ qua kiểm tra kỳ trước cho hộ mới chưa có lịch sử", async () => {
    const originalFindUniquePeriod = prisma.billingPeriod.findUnique;
    const originalFindUniqueReading = prisma.meterReading.findUnique;
    const originalFindFirstReading = prisma.meterReading.findFirst;

    prisma.billingPeriod.findUnique = (() =>
      Promise.resolve({ id: "period-5", year: 2026, month: 5 })) as typeof originalFindUniquePeriod;
    prisma.meterReading.findUnique = (() => Promise.resolve(null)) as typeof originalFindUniqueReading;
    prisma.meterReading.findFirst = (() => Promise.resolve(null)) as typeof originalFindFirstReading;

    try {
      await assertPriorPeriodReadingConfirmed("household-new", { year: 2026, month: 6 });
    } finally {
      prisma.billingPeriod.findUnique = originalFindUniquePeriod;
      prisma.meterReading.findUnique = originalFindUniqueReading;
      prisma.meterReading.findFirst = originalFindFirstReading;
    }
  });

  it("cho phép bỏ qua kỳ liền trước nếu kỳ đó chưa ghi dữ liệu", async () => {
    const originalFindUniquePeriod = prisma.billingPeriod.findUnique;
    const originalFindUniqueReading = prisma.meterReading.findUnique;
    const originalFindFirstReading = prisma.meterReading.findFirst;

    prisma.billingPeriod.findUnique = (() =>
      Promise.resolve({ id: "period-5", year: 2026, month: 5 })) as typeof originalFindUniquePeriod;
    prisma.meterReading.findUnique = (() => Promise.resolve(null)) as typeof originalFindUniqueReading;
    prisma.meterReading.findFirst = (() => Promise.resolve({ id: "older-reading" })) as typeof originalFindFirstReading;

    try {
      await assertPriorPeriodReadingConfirmed("household-old", { year: 2026, month: 6 });
    } finally {
      prisma.billingPeriod.findUnique = originalFindUniquePeriod;
      prisma.meterReading.findUnique = originalFindUniqueReading;
      prisma.meterReading.findFirst = originalFindFirstReading;
    }
  });

  it("vẫn chặn nếu kỳ liền trước đã nhập dữ liệu nhưng chưa chốt", async () => {
    const originalFindUniquePeriod = prisma.billingPeriod.findUnique;
    const originalFindUniqueReading = prisma.meterReading.findUnique;
    const originalFindFirstReading = prisma.meterReading.findFirst;

    prisma.billingPeriod.findUnique = (() =>
      Promise.resolve({ id: "period-5", year: 2026, month: 5 })) as typeof originalFindUniquePeriod;
    prisma.meterReading.findUnique = (() =>
      Promise.resolve({
        status: "PENDING",
        confirmedValue: 125,
        ocrValue: null,
        imagePath: null,
      })) as typeof originalFindUniqueReading;
    prisma.meterReading.findFirst = (() => Promise.resolve({ id: "older-reading" })) as typeof originalFindFirstReading;

    try {
      await assert.rejects(
        () => assertPriorPeriodReadingConfirmed("household-old", { year: 2026, month: 6 }),
        /Chưa chốt chỉ số Tháng 5\/2026/
      );
    } finally {
      prisma.billingPeriod.findUnique = originalFindUniquePeriod;
      prisma.meterReading.findUnique = originalFindUniqueReading;
      prisma.meterReading.findFirst = originalFindFirstReading;
    }
  });
});
