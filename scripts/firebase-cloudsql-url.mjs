#!/usr/bin/env node
/**
 * In connection string Cloud SQL tiennuoc cho Prisma / App Hosting.
 * Mật khẩu: .tiennuoc-db-pass hoặc .cloudsql-app-pass (không commit).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const passCandidates = [
  resolve(root, ".tiennuoc-db-pass"),
  resolve(root, ".cloudsql-app-pass"),
];
const passFile = passCandidates.find((p) => existsSync(p));

if (!passFile) {
  console.error("Thiếu .tiennuoc-db-pass hoặc .cloudsql-app-pass — tạo user Cloud SQL trước.");
  process.exit(1);
}

const pass = readFileSync(passFile, "utf8").trim();
const user = process.env.DB_USER ?? "tiennuoc_app";
const db = process.env.DB_NAME ?? "tiennuoc_water";
const instance =
  process.env.CLOUD_SQL_INSTANCE ?? "tiennuoc:asia-southeast1:tiennuoc-db";
const publicHost = process.env.CLOUDSQL_PUBLIC_IP ?? "34.21.202.114";
const proxyPort = process.env.CLOUDSQL_PORT ?? "5433";

// Prisma + Cloud Run: host TCP + query host= socket (có dấu / cuối instance)
const socketUrl = `postgresql://${user}:${encodeURIComponent(pass)}@127.0.0.1:5432/${db}?host=/cloudsql/${instance}/`;

console.log("# App Hosting / production (socket qua Cloud SQL connector)");
console.log(`DATABASE_URL=${socketUrl}`);
console.log(`DATABASE_URL_UNPOOLED=${socketUrl}`);
console.log("");
console.log(`# Local qua cloud-sql-proxy (port ${proxyPort})`);
console.log(
  `DATABASE_URL=postgresql://${user}:${encodeURIComponent(pass)}@127.0.0.1:${proxyPort}/${db}`
);
