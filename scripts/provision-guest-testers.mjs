#!/usr/bin/env node
/**
 * Đồng bộ Firebase Auth cho guest01…guest20 (sau db:seed-guest-testers).
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const PASSWORD = "GuestTest2026!";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const provision = resolve(ROOT, "scripts/firebase-provision-auth.mjs");

for (let n = 1; n <= 20; n++) {
  const account = `guest${String(n).padStart(2, "0")}`;
  console.log(`→ ${account}`);
  execFileSync(
    process.execPath,
    ["--import", "tsx", provision, "--account", account, "--password", PASSWORD],
    { cwd: ROOT, stdio: "inherit" },
  );
}

console.log("\n✔ Đã đồng bộ Firebase cho 20 guest.");
