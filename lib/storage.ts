import fs from "fs/promises";
import path from "path";
import { env } from "./env";

/** Vercel/Lambda: chỉ `/tmp` ghi được; local dev: thư mục project. */
function isServerlessFs(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function storageRoot(): string {
  const configured = env.storageDir().replace(/^\/+/, "");
  if (isServerlessFs()) {
    if (configured.startsWith("tmp/") || configured === "tmp") {
      return path.join("/tmp", configured === "tmp" ? "firebase-water-storage" : configured.slice(4));
    }
    return path.join("/tmp", configured || "firebase-water-storage");
  }
  return path.resolve(process.cwd(), configured || "storage");
}

export async function ensureStorageSubdir(subdir: string): Promise<string> {
  const dir = path.join(storageRoot(), subdir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function saveBuffer(
  subdir: string,
  filename: string,
  data: Buffer
): Promise<string> {
  const dir = await ensureStorageSubdir(subdir);
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, data);
  return path.join(subdir, filename);
}

export function resolveStoragePath(relativePath: string): string {
  return path.join(storageRoot(), relativePath);
}

export async function readStorageFile(relativePath: string): Promise<Buffer> {
  return fs.readFile(resolveStoragePath(relativePath));
}
