import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HouseholdStatus } from "../lib/types/enums";
import { householdStatusLabel } from "../lib/vi";

/** Hộ mới tạo phải ACTIVE — khớp payload create trong actions + mobileAdminHouseholds. */
export const NEW_HOUSEHOLD_CREATE_DEFAULTS = {
  status: HouseholdStatus.ACTIVE,
  inactiveFromYear: null,
  inactiveFromMonth: null,
} as const;

describe("new household defaults", () => {
  it("create payload uses ACTIVE status", () => {
    assert.equal(NEW_HOUSEHOLD_CREATE_DEFAULTS.status, "ACTIVE");
    assert.equal(NEW_HOUSEHOLD_CREATE_DEFAULTS.inactiveFromYear, null);
    assert.equal(NEW_HOUSEHOLD_CREATE_DEFAULTS.inactiveFromMonth, null);
  });

  it("ACTIVE maps to Đang sử dụng", () => {
    assert.equal(householdStatusLabel(HouseholdStatus.ACTIVE), "Đang sử dụng");
  });

  it("INACTIVE maps to Ngưng sử dụng", () => {
    assert.equal(householdStatusLabel(HouseholdStatus.INACTIVE), "Ngưng sử dụng");
  });
});
