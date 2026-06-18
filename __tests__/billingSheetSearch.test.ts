import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  billingSheetSearchScore,
  matchesBillingSheetSearch,
  normalizeBillingSheetSearch,
} from "../lib/billingSheetSearch";

describe("billingSheetSearch", () => {
  const row = {
    householdCode: "ĐH-212",
    meterCode: "DH212",
    residentName: "Nguyễn Văn A",
    address: "Xã Tiên Lãng",
    contactPhone: "0912345678",
    routeName: "Tuyến 1",
  };

  it("normalizes Vietnamese diacritics and đ", () => {
    assert.equal(normalizeBillingSheetSearch("ĐH-212"), "dh-212");
    assert.equal(normalizeBillingSheetSearch("Nguyễn"), "nguyen");
  });

  it("matches household code without diacritics", () => {
    assert.equal(matchesBillingSheetSearch(row, "dh212"), true);
    assert.equal(matchesBillingSheetSearch(row, "212"), true);
  });

  it("matches multiple tokens", () => {
    assert.equal(matchesBillingSheetSearch(row, "nguyen xa"), true);
    assert.equal(matchesBillingSheetSearch(row, "nguyen hue"), false);
  });

  it("matches phone fragment", () => {
    assert.equal(matchesBillingSheetSearch(row, "912345"), true);
  });

  it("is case insensitive", () => {
    assert.equal(matchesBillingSheetSearch(row, "NGUYEN VAN"), true);
    assert.equal(matchesBillingSheetSearch(row, "ĐH-212"), true);
  });

  it("matches name tokens in any order", () => {
    const named = { ...row, residentName: "Phạm Văn Nhung" };
    assert.equal(matchesBillingSheetSearch(named, "nhung pham"), true);
    assert.equal(matchesBillingSheetSearch(named, "pham nhung"), true);
    assert.equal(matchesBillingSheetSearch(named, "PHAM NHUNG"), true);
    assert.equal(matchesBillingSheetSearch(named, "van nhung"), true);
  });

  it("does not match unrelated names", () => {
    const named = { ...row, residentName: "Lương Thị Mơ" };
    assert.equal(matchesBillingSheetSearch(named, "duong"), false);
    assert.equal(matchesBillingSheetSearch(named, "dương"), false);
  });

  it("ranks exact name matches higher", () => {
    const duong = { ...row, residentName: "Nguyễn Văn Đương" };
    const luong = { ...row, residentName: "Lương Thị Mơ" };
    const scoreDuong = billingSheetSearchScore(duong, "duong");
    const scoreLuong = billingSheetSearchScore(luong, "duong");
    assert.equal(matchesBillingSheetSearch(duong, "duong"), true);
    assert.equal(matchesBillingSheetSearch(luong, "duong"), false);
    assert.ok(scoreDuong > scoreLuong);
  });

  it("prefers Dương over Đương when query keeps d vs đ", () => {
    const dLetter = { ...row, residentName: "Nguyễn Văn Dương" };
    const ddLetter = { ...row, residentName: "Nguyễn Văn Đương" };
    assert.equal(matchesBillingSheetSearch(dLetter, "Dương"), true);
    assert.equal(matchesBillingSheetSearch(ddLetter, "Dương"), true);
    const scoreD = billingSheetSearchScore(dLetter, "Dương");
    const scoreDD = billingSheetSearchScore(ddLetter, "Dương");
    assert.ok(scoreD > scoreDD, `Dương ${scoreD} should beat Đương ${scoreDD}`);
  });

  it("prefers Đương over Dương when query uses đ", () => {
    const dLetter = { ...row, residentName: "Trần Văn Dương" };
    const ddLetter = { ...row, residentName: "Trần Văn Đương" };
    const scoreD = billingSheetSearchScore(dLetter, "Đương");
    const scoreDD = billingSheetSearchScore(ddLetter, "Đương");
    assert.ok(scoreDD > scoreD, `Đương ${scoreDD} should beat Dương ${scoreD}`);
  });
});
