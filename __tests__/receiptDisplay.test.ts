import assert from "node:assert/strict";
import test from "node:test";
import { displayResidentName } from "../lib/receiptDisplay";

test("displayResidentName strips trailing household code", () => {
  assert.equal(
    displayResidentName("Trần Kim Oanh — M21201", "M21201"),
    "Trần Kim Oanh"
  );
});
