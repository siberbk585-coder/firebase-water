import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDateTimeVN, VN_TIMEZONE } from "../lib/datetime";

describe("formatDateTimeVN", () => {
  it("dùng Asia/Ho_Chi_Minh (+7 so với UTC)", () => {
    assert.equal(VN_TIMEZONE, "Asia/Ho_Chi_Minh");
    const utc = new Date("2026-05-28T10:30:00.000Z");
    const formatted = formatDateTimeVN(utc);
    assert.match(formatted, /17:30/);
    assert.match(formatted, /28/);
  });

  it("null/undefined → chuỗi rỗng", () => {
    assert.equal(formatDateTimeVN(null), "");
    assert.equal(formatDateTimeVN(undefined), "");
  });
});
