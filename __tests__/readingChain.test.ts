import assert from "node:assert/strict";
import test from "node:test";
import { ReadingStatus } from "@/lib/types/enums";
import { resolveOldReadingForRow } from "../lib/readings";

test("resolveOldReadingForRow: chưa chốt dùng CSC từ chuỗi kỳ trước", () => {
  assert.equal(
    resolveOldReadingForRow(
      { status: ReadingStatus.PENDING, oldReading: 100 },
      160
    ),
    160
  );
});

test("resolveOldReadingForRow: đã chốt giữ CSC đã lưu lúc chốt", () => {
  assert.equal(
    resolveOldReadingForRow(
      { status: ReadingStatus.CONFIRMED, oldReading: 145 },
      160
    ),
    145
  );
});
