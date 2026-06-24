import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isSandboxRouteCode,
  isSandboxUsername,
} from "../lib/sandboxRoutes";

describe("sandboxRoutes", () => {
  it("nhận diện tuyến guest và play review", () => {
    assert.equal(isSandboxRouteCode("GUEST-01"), true);
    assert.equal(isSandboxRouteCode("PLAY-REVIEW"), true);
    assert.equal(isSandboxRouteCode("TUYEN-01"), false);
  });

  it("nhận diện username guest và playreview", () => {
    assert.equal(isSandboxUsername("guest01"), true);
    assert.equal(isSandboxUsername("guest20"), true);
    assert.equal(isSandboxUsername("playreview"), true);
    assert.equal(isSandboxUsername("admin"), false);
    assert.equal(isSandboxUsername("guest1"), false);
  });
});
