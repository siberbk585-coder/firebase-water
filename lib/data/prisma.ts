import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { isServerlessRuntime } from "../runtime";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaInit?: Promise<PrismaClient>;
};

function logLevel(): ("error" | "warn")[] {
  return process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
}

function useCloudSqlConnector(): boolean {
  if (!process.env.DATABASE_URL?.includes("cloudsql")) return false;
  return isServerlessRuntime() || process.env.NODE_ENV === "production";
}

function parseDbUrl(url: string) {
  const normalized = url.replace(/^postgresql:/, "http:");
  const u = new URL(normalized);
  const hostMatch = url.match(/[?&]host=([^&]+)/);
  const socketPath = hostMatch?.[1]?.replace(/\/$/, "") ?? "";
  const instance = socketPath.replace(/^\/?cloudsql\//, "");
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    instance: instance || "tiennuoc:asia-southeast1:tiennuoc-db",
  };
}

async function createPrismaClient(): Promise<PrismaClient> {
  if (!useCloudSqlConnector()) {
    return new PrismaClient({ log: logLevel() });
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required on App Hosting");
  }

  const { user, password, database, instance } = parseDbUrl(url);
  const poolOpts = {
    user,
    password,
    database,
    // Cloud SQL tier nhỏ: mỗi instance chỉ giữ 1 kết nối (tránh P2037 khi scale)
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  };

  // Cloud Run: dùng Unix socket (run.googleapis.com/cloudsql-instances) — ổn định hơn Connector API
  const pool =
    process.env.K_SERVICE != null
      ? new Pool({ ...poolOpts, host: `/cloudsql/${instance}` })
      : new Pool({
          ...(await (async () => {
            const { Connector } = await import("@google-cloud/cloud-sql-connector");
            const connector = new Connector();
            return connector.getOptions({ instanceConnectionName: instance });
          })()),
          ...poolOpts,
        });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log: logLevel(),
  });
}

/** Gọi từ instrumentation.ts trước khi xử lý request (App Hosting). */
export async function initPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!globalForPrisma.prismaInit) {
    globalForPrisma.prismaInit = createPrismaClient().then((client) => {
      globalForPrisma.prisma = client;
      return client;
    });
  }
  return globalForPrisma.prismaInit;
}

function getSyncPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (useCloudSqlConnector()) {
    throw new Error(
      "Prisma chưa khởi tạo trên Cloud Run — kiểm tra instrumentation.ts"
    );
  }
  globalForPrisma.prisma = new PrismaClient({ log: logLevel() });
  return globalForPrisma.prisma;
}

/** Prisma truy cập PostgreSQL (schema do Data Connect quản lý). */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getSyncPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

if (process.env.NODE_ENV !== "production") {
  void initPrisma();
}
