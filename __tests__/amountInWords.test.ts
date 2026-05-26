import assert from "node:assert/strict";
import test from "node:test";
import { amountInWordsVn } from "../lib/amountInWords";

test("amountInWordsVn — các mức thường gặp", () => {
  assert.equal(amountInWordsVn(825_000), "tám trăm hai mươi lăm nghìn");
  assert.equal(amountInWordsVn(1_534_286), "một triệu năm trăm ba mươi bốn nghìn hai trăm tám mươi sáu");
});
