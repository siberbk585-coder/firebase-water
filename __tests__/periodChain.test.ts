import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calendarPriorPeriod } from "../lib/periodChain";

describe("periodChain", () => {
  it("calendarPriorPeriod — tháng liền kề", () => {
    assert.deepEqual(calendarPriorPeriod(2026, 5), { year: 2026, month: 4 });
    assert.deepEqual(calendarPriorPeriod(2026, 1), { year: 2025, month: 12 });
  });
});
