import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertDestructiveAllowed,
  isProductionDatabase,
} from "../lib/destructiveDbGuard";

describe("destructiveDbGuard", () => {
  it("nhận diện URL production", () => {
    assert.equal(
      isProductionDatabase(
        "postgresql://u:p@localhost:5434/tiennuoc_water?host=/cloudsql/tiennuoc:asia-southeast1:tiennuoc-db"
      ),
      true
    );
    assert.equal(
      isProductionDatabase("postgresql://u:p@localhost:5432/water_billing_dev"),
      false
    );
  });

  it("chặn seed trên production khi không có override", () => {
    const prev = process.env.DATABASE_URL;
    const prevAllow = process.env.ALLOW_DESTRUCTIVE_DB;
    process.env.DATABASE_URL =
      "postgresql://x@127.0.0.1:5434/tiennuoc_water";
    delete process.env.ALLOW_DESTRUCTIVE_DB;
    try {
      assert.throws(
        () => assertDestructiveAllowed("test"),
        /Từ chối.*production/
      );
    } finally {
      if (prev === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prev;
      if (prevAllow === undefined) delete process.env.ALLOW_DESTRUCTIVE_DB;
      else process.env.ALLOW_DESTRUCTIVE_DB = prevAllow;
    }
  });
});
