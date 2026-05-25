#!/usr/bin/env node
/**
 * Tạo user Postgres tiennuoc_app trên Cloud SQL (một lần).
 * Ghi mật khẩu vào .tiennuoc-db-pass (gitignore).
 *
 *   npm run firebase:create-db-user
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const PROJECT = "tiennuoc";
const INSTANCE = "tiennuoc-db";
const USER = "tiennuoc_app";
const passFile = resolve(root, ".tiennuoc-db-pass");

const pass = randomBytes(18).toString("base64url");

console.log(`Tạo user ${USER} trên ${INSTANCE}…`);
try {
  execFileSync(
    "gcloud",
    [
      "sql",
      "users",
      "create",
      USER,
      `--instance=${INSTANCE}`,
      `--project=${PROJECT}`,
      `--password=${pass}`,
    ],
    { stdio: "inherit" }
  );
} catch (e) {
  console.error("Nếu user đã tồn tại, đặt mật khẩu thủ công:");
  console.error(
    `  gcloud sql users set-password ${USER} --instance=${INSTANCE} --project=${PROJECT} --password='...'`
  );
  process.exit(1);
}

writeFileSync(passFile, pass + "\n", { mode: 0o600 });
console.log(`Đã lưu mật khẩu → .tiennuoc-db-pass`);
console.log("Tiếp theo:");
console.log("  npm run firebase:secrets");
console.log("  npm run firebase:wire-cloudsql");
console.log("  npm run firebase:deploy-apphosting");
