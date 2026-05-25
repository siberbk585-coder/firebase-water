/**
 * Prisma client kết nối Cloud SQL tiennuoc (IAM hoặc DATABASE_URL).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Connector, AuthTypes } from "@google-cloud/cloud-sql-connector";
import { Pool } from "pg";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const INSTANCE =
  process.env.CLOUD_SQL_INSTANCE ?? "tiennuoc:asia-southeast1:tiennuoc-db";
const DB_NAME = process.env.DB_NAME ?? "tiennuoc_water";

export async function createPrismaTiennuoc(): Promise<PrismaClient> {
  if (process.env.DATABASE_URL?.includes("tiennuoc_water")) {
    return new PrismaClient();
  }

  const passFile = resolve(process.cwd(), ".tiennuoc-db-pass");
  if (existsSync(passFile)) {
    const pass = readFileSync(passFile, "utf8").trim();
    const user = process.env.DB_USER ?? "tiennuoc_app";
    const port = process.env.CLOUDSQL_PORT ?? "5434";
    process.env.DATABASE_URL = `postgresql://${user}:${encodeURIComponent(pass)}@127.0.0.1:${port}/${DB_NAME}`;
    return new PrismaClient();
  }

  const email =
    process.env.DB_IAM_USER ??
    process.env.GCLOUD_SQL_IAM_USER ??
    "daohoangduong1997@gmail.com";

  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: INSTANCE,
    authType: AuthTypes.IAM,
  });

  const pool = new Pool({
    ...clientOpts,
    user: email,
    database: DB_NAME,
    max: 3,
  });

  return new PrismaClient({ adapter: new PrismaPg(pool) });
}
