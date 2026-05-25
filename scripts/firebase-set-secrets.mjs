#!/usr/bin/env node
/**
 * Đẩy secrets App Hosting — project tiennuoc.
 * DATABASE_URL: từ env, .env, hoặc npm run firebase:cloudsql-url (cần .tiennuoc-db-pass).
 */
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function setSecret(name, value) {
  if (!value) {
    console.warn(`Bỏ qua ${name} (rỗng)`);
    return;
  }
  console.log(`Set secret: ${name}`);
  execFileSync(
    "npx",
    ["-y", "firebase-tools@latest", "apphosting:secrets:set", name, "--data-file", "-", "--force"],
    {
      input: value,
      stdio: ["pipe", "inherit", "inherit"],
      cwd: root,
    }
  );
}

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i)] = val;
  }
  return out;
}

function databaseUrlFromCloudsqlScript() {
  try {
    const script = resolve(__dirname, "firebase-cloudsql-url.mjs");
    const out = execSync(`node "${script}"`, {
      cwd: root,
      encoding: "utf8",
    });
    const line = out
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.startsWith("DATABASE_URL=") && !l.startsWith("DATABASE_URL_UNPOOLED"));
    return line?.slice("DATABASE_URL=".length).trim() ?? "";
  } catch (e) {
    console.warn("Không đọc được firebase-cloudsql-url:", e.message);
    return "";
  }
}

const localEnv = loadEnvFile(resolve(root, ".env"));

let sessionSecret = process.env.SESSION_SECRET || localEnv.SESSION_SECRET;
if (!sessionSecret) {
  sessionSecret =
    "tiennuoc-" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  console.warn("Tạo SESSION_SECRET mới.");
}
setSecret("SESSION_SECRET", sessionSecret);

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  localEnv.NEXT_PUBLIC_APP_URL ||
  "https://tiennuoc.web.app";
setSecret("NEXT_PUBLIC_APP_URL", appUrl);

function pickTiennuocDbUrl(...candidates) {
  for (const url of candidates) {
    if (!url) continue;
    if (url.includes("tiennuoc_water") || url.includes("/cloudsql/tiennuoc")) {
      return url;
    }
  }
  return "";
}

const dbUrl = pickTiennuocDbUrl(
  databaseUrlFromCloudsqlScript(),
  process.env.DATABASE_URL,
  localEnv.DATABASE_URL
);

if (dbUrl) {
  setSecret("DATABASE_URL", dbUrl);
  setSecret(
    "DATABASE_URL_UNPOOLED",
    process.env.DATABASE_URL_UNPOOLED || localEnv.DATABASE_URL_UNPOOLED || dbUrl
  );
} else {
  console.warn(
    "Bỏ qua DATABASE_URL — chưa có connection string tiennuoc. Chạy: npm run firebase:create-db-user rồi npm run firebase:secrets"
  );
}

const optionalSecrets = [
  "UPLOAD_API_KEY",
  "N8N_IMAGE_WEBHOOK_URL",
  "N8N_INVOICE_WEBHOOK_URL",
  "N8N_ZALO_WEBHOOK_URL",
  "BLOB_READ_WRITE_TOKEN",
  "BANK_BIN",
  "BANK_ACCOUNT",
  "BANK_ACCOUNT_NAME",
];

for (const key of optionalSecrets) {
  const val = process.env[key] || localEnv[key];
  if (val) setSecret(key, val);
}

console.log("Xong secrets App Hosting (tiennuoc).");
