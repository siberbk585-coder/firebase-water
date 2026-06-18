import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterRoutesForSession } from "../lib/collectorAccess";
import { UserRole } from "../lib/types/enums";

/** Logic khớp app/api/mobile/bootstrap/route.ts — routeAccess + lọc tuyến. */
function mobileBootstrapRouteAccess(
  role: UserRole,
  allowedRouteIds: string[]
): "all" | "none" | "assigned" {
  if (role === UserRole.ADMIN) return "all";
  if (!allowedRouteIds.length) return "none";
  return "assigned";
}

const collectorSession = {
  id: "collector-1",
  phone: "collector:test",
  name: "Thu KV1",
  role: UserRole.COLLECTOR,
  username: "thu_kv1",
};

describe("mobile bootstrap contract", () => {
  it("routeAccess reflects collector assignment state", () => {
    assert.equal(mobileBootstrapRouteAccess(UserRole.ADMIN, []), "all");
    assert.equal(mobileBootstrapRouteAccess(UserRole.COLLECTOR, []), "none");
    assert.equal(
      mobileBootstrapRouteAccess(UserRole.COLLECTOR, ["route-a"]),
      "assigned"
    );
  });

  it("collector bootstrap routes are filtered to assignments", () => {
    const all = [
      { id: "route-a", name: "A" },
      { id: "route-b", name: "B" },
    ];
    const filtered = filterRoutesForSession(collectorSession, all, ["route-b"]);
    assert.deepEqual(filtered, [{ id: "route-b", name: "B" }]);
  });
});
