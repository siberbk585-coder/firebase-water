import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { buildImageFilename } from "./filename";
import { postImageToN8nWebhook, n8nImageWebhookUrl } from "./n8nWebhook";
import { saveBuffer } from "./storage";

export type ImageUploadResult = {
  url: string;
  pathname: string;
  storage: "n8n-webhook" | "vercel-blob" | "local";
};

function extFromContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function appBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Gửi chỉ số kèm ảnh: n8n webhook → link (webContentLink / url) → lưu `imagePath` DB.
 * Không có ảnh: không gọi hàm này — `submitManualReading` ghi DB trực tiếp.
 */
export async function uploadReadingImageViaN8n(
  buffer: Buffer,
  opts: {
    filename: string;
    householdId: string;
    periodId: string;
    householdCode: string;
    confirmedValue: number;
    contentType?: string;
  }
): Promise<string> {
  if (!buffer.length) {
    throw new Error("Thiếu dữ liệu ảnh");
  }
  if (!n8nImageWebhookUrl()) {
    throw new Error("Chưa bật webhook n8n (N8N_IMAGE_WEBHOOK_URL) để lưu ảnh");
  }
  const n8n = await postImageToN8nWebhook(buffer, {
    filename: opts.filename,
    contentType: opts.contentType ?? "image/jpeg",
    householdId: opts.householdId,
    periodId: opts.periodId,
    householdCode: opts.householdCode,
    confirmedValue: opts.confirmedValue,
  });
  return n8n.url;
}

/** Upload ảnh chung (API/MCP) — ưu tiên n8n, rồi Blob, rồi local. */
export async function uploadImageBuffer(
  buffer: Buffer,
  opts?: {
    filename?: string;
    contentType?: string;
    householdId?: string;
    periodId?: string;
    householdCode?: string;
    confirmedValue?: number;
  }
): Promise<ImageUploadResult> {
  const contentType = opts?.contentType ?? "image/jpeg";
  const ext = opts?.filename?.split(".").pop() || extFromContentType(contentType);
  const filename =
    opts?.filename && /^\d{8}_\d{6}_/.test(opts.filename)
      ? opts.filename
      : buildImageFilename({
          prefix: "meter",
          code: opts?.householdCode,
          ext,
        });

  if (n8nImageWebhookUrl()) {
    const n8n = await postImageToN8nWebhook(buffer, {
      filename,
      contentType,
      householdId: opts?.householdId,
      periodId: opts?.periodId,
      householdCode: opts?.householdCode,
      confirmedValue: opts?.confirmedValue,
    });
    return { url: n8n.url, pathname: n8n.url, storage: "n8n-webhook" };
  }

  const pathname = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(pathname, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname, storage: "vercel-blob" };
  }

  const relative = await saveBuffer("uploads", `${randomUUID()}.${ext}`, buffer);
  const url = `${appBaseUrl()}/api/files/${relative}`;
  return { url, pathname: relative, storage: "local" };
}
