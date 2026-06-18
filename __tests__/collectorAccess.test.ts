import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHouseholdBillableInPeriod } from "../lib/householdBillable";
import {
  filterRoutesForSession,
  resolveCollectorRouteQuery,
} from "../lib/collectorAccess";
import { UserRole } from "../lib/types/enums";

const adminSession = {
  id: "admin-1",
  phone: "admin",
  name: "Admin",
  role: UserRole.ADMIN,
};

const collectorSession = {
  id: "collector-1",
  phone: "collector:test",
  name: "Thu KV1",
  role: UserRole.COLLECTOR,
  username: "thu_kv1",
};

describe("collectorAccess helpers", () => {
  it("resolveCollectorRouteQuery allows admin any route", () => {
    assert.equal(resolveCollectorRouteQuery(adminSession, "route-a", []), "route-a");
    assert.equal(resolveCollectorRouteQuery(adminSession, "all", []), null);
  });

  it("resolveCollectorRouteQuery restricts collector routes", () => {
    assert.equal(
      resolveCollectorRouteQuery(collectorSession, "route-a", ["route-a", "route-b"]),
      "route-a"
    );
    assert.equal(
      resolveCollectorRouteQuery(collectorSession, "route-x", ["route-a"]),
      "__denied__"
    );
    assert.equal(resolveCollectorRouteQuery(collectorSession, undefined, ["route-a"]), "route-a");
    assert.equal(
      resolveCollectorRouteQuery(collectorSession, "all", ["route-a", "route-b"]),
      null
    );
  });

  it("filterRoutesForSession hides unassigned routes from collector", () => {
    const routes = [
      { id: "route-a", name: "A" },
      { id: "route-b", name: "B" },
    ];
    assert.deepEqual(filterRoutesForSession(collectorSession, routes, ["route-a"]), [
      { id: "route-a", name: "A" },
    ]);
    assert.deepEqual(filterRoutesForSession(adminSession, routes, ["route-a"]), routes);
  });
});

describe("householdBillable still works", () => {
  it("ACTIVE household billable", () => {
    assert.equal(
      isHouseholdBillableInPeriod(
        { status: "ACTIVE", inactiveFromYear: null, inactiveFromMonth: null },
        2026,
        6
      ),
      true
    );
  });
});
