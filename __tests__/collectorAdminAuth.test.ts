import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MobileAdminError } from "../lib/mobileAdminCollectors";

describe("collector admin password policy", () => {
  it("rejects short password before DB access", async () => {
    const { resetCollectorPasswordForMobile } = await import(
      "../lib/mobileAdminCollectors"
    );

    await assert.rejects(
      () =>
        resetCollectorPasswordForMobile(
          { id: "admin-1", phone: "admin", name: "Admin", role: "ADMIN" },
          "collector-1",
          "12345"
        ),
      (e: unknown) => {
        assert.ok(e instanceof MobileAdminError);
        assert.match(e.message, /6 ký tự/);
        return true;
      }
    );
  });
});
