#!/usr/bin/env node
/**
 * Copy PostgreSQL từ Neon (dự án cũ) sang Cloud SQL (Firebase).
 *
 * Yêu cầu:
 * - Cloud SQL instance `firebase-water-db` đang RUNNING
 * - Đã chạy: npx firebase-tools@latest dataconnect:sql:setup
 * - Biến DEST_DATABASE_URL trỏ tới Cloud SQL (database firebase_water hoặc app)
 *
 * Nguồn: SOURCE_ENV_FILE (mặc định ../water-ocr-billing/.env.production.local)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PG_DUMP = process.env.PG_DUMP || "/opt/homebrew/opt/libpq/bin/pg_dump";
const PSQL = process.env.PSQL || "/opt/homebrew/opt/libpq/bin/psql";

function loadEnvFile(path) {
  if (!existsSync(path)) throw new Error(`Không tìm thấy file env: ${path}`);
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i);
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function pickSourceUrl(env) {
  return (
    env.DATABASE_URL_UNPOOLED ||
    env.POSTGRES_URL_NON_POOLING ||
    env.DIRECT_URL ||
    env.DATABASE_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRES_URL
  );
}

const sourceEnvPath =
  process.env.SOURCE_ENV_FILE ||
  resolve(__dirname, "../../water-ocr-billing/.env.production.local");
const destUrl = process.env.DEST_DATABASE_URL;

if (!destUrl) {
  console.error("Thiếu DEST_DATABASE_URL — connection string Cloud SQL Postgres.");
  process.exit(1);
}

if (!existsSync(PG_DUMP) || !existsSync(PSQL)) {
  console.error(`Cần pg_dump/psql. Cài: brew install libpq`);
  console.error(`Hoặc set PG_DUMP và PSQL trỏ tới binary.`);
  process.exit(1);
}

const sourceEnv = loadEnvFile(sourceEnvPath);
const sourceUrl = pickSourceUrl(sourceEnv);
if (!sourceUrl) {
  console.error(`Không có DATABASE_URL trong ${sourceEnvPath}`);
  process.exit(1);
}

console.log("Nguồn:", sourceEnvPath.replace(process.env.HOME || "", "~"));
console.log("Đích: Cloud SQL (DEST_DATABASE_URL)");
console.log("Đang dump schema + data (có thể vài phút)...");

const dump = execFileSync(
  PG_DUMP,
  ["--no-owner", "--no-acl", "--clean", "--if-exists", "-d", sourceUrl],
  { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 }
);

console.log(`Dump xong (${(dump.length / 1024 / 1024).toFixed(1)} MB). Đang restore...`);

execFileSync(PSQL, [destUrl, "-v", "ON_ERROR_STOP=1"], {
  input: dump,
  stdio: ["pipe", "inherit", "inherit"],
});

console.log("Hoàn tất copy database.");
