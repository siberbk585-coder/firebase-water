#!/usr/bin/env node
/**
 * Cấp quyền tiennuoc_app trên tiennuoc_water (IAM qua Cloud SQL Connector).
 */
import { Pool } from "pg";
import { Connector, AuthTypes } from "@google-cloud/cloud-sql-connector";

const INSTANCE = "tiennuoc:asia-southeast1:tiennuoc-db";
const IAM_USER = process.env.DB_IAM_USER ?? "daohoangduong1997@gmail.com";

const connector = new Connector();
const opts = await connector.getOptions({
  instanceConnectionName: INSTANCE,
  authType: AuthTypes.IAM,
});

const pool = new Pool({
  ...opts,
  user: IAM_USER,
  database: "tiennuoc_water",
  max: 1,
});

const sql = [
  "GRANT USAGE ON SCHEMA public TO tiennuoc_app",
  "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tiennuoc_app",
  "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tiennuoc_app",
  "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tiennuoc_app",
];

for (const q of sql) {
  await pool.query(q);
  console.log("OK:", q.slice(0, 55) + "…");
}

await pool.end();
await connector.close();
console.log("Đã grant quyền cho tiennuoc_app.");
