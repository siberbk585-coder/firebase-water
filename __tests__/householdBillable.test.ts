import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comparePeriod,
  isHouseholdBillableInPeriod,
  isPeriodOnOrBefore,
} from "../lib/householdBillable";

describe("householdBillable", () => {
  it("comparePeriod orders by year then month", () => {
    assert.equal(comparePeriod({ year: 2026, month: 5 }, { year: 2026, month: 6 }), -1);
    assert.equal(comparePeriod({ year: 2025, month: 12 }, { year: 2026, month: 1 }), -1);
  });

  it("ACTIVE household always billable", () => {
    assert.equal(
      isHouseholdBillableInPeriod(
        { status: "ACTIVE", inactiveFromYear: null, inactiveFromMonth: null },
        2026,
        6
      ),
      true
    );
  });

  it("INACTIVE from T6/2026: thu T5/T6, không thu T7", () => {
    const h = {
      status: "INACTIVE",
      inactiveFromYear: 2026,
      inactiveFromMonth: 6,
    };
    assert.equal(isHouseholdBillableInPeriod(h, 2026, 5), true);
    assert.equal(isHouseholdBillableInPeriod(h, 2026, 6), true);
    assert.equal(isHouseholdBillableInPeriod(h, 2026, 7), false);
  });

  it("INACTIVE without inactiveFrom* not billable", () => {
    assert.equal(
      isHouseholdBillableInPeriod(
        { status: "INACTIVE", inactiveFromYear: null, inactiveFromMonth: null },
        2026,
        6
      ),
      false
    );
  });

  it("isPeriodOnOrBefore", () => {
    assert.equal(isPeriodOnOrBefore({ year: 2026, month: 6 }, { year: 2026, month: 6 }), true);
    assert.equal(isPeriodOnOrBefore({ year: 2026, month: 7 }, { year: 2026, month: 6 }), false);
  });
});
