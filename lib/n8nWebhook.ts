import { buildImageFilename, uploadedAtIso } from "./filename";
import { extractUrlFromN8nResponse } from "./n8nLink";

export type N8nImageUploadResult = {
  url: string;
  raw?: unknown;
};

export function n8nImageWebhookUrl(): string | null {
  if (process.env.N8N_IMAGE_WEBHOOK_DISABLED === "true") return null;
  const url = process.env.N8N_IMAGE_WEBHOOK_URL?.trim();
  return url || null;
}

/** Gửi ảnh lên webhook n8n — workflow n8n trả `url` (Respond to Webhook). */
export async function postImageToN8nWebhook(
  buffer: Buffer,
  meta?: {
    filename?: string;
    contentType?: string;
    householdId?: string;
    periodId?: string;
    householdCode?: string;
    confirmedValue?: number;
  }
): Promise<N8nImageUploadResult> {
  const webhookUrl = n8nImageWebhookUrl();
  if (!webhookUrl) {
    throw new Error("Chưa cấu hình N8N_IMAGE_WEBHOOK_URL");
  }

  const contentType = meta?.contentType ?? "image/jpeg";
  const ext = meta?.filename?.split(".").pop() || contentType.split("/").pop() || "jpg";
  const filename =
    meta?.filename && /^\d{8}_\d{6}_/.test(meta.filename)
      ? meta.filename
      : buildImageFilename({
          prefix: "meter",
          code: meta?.householdCode,
          ext,
        });

  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(buffer)], { type: contentType }), filename);
  form.append("filename", filename);
  form.append("uploaded_at", uploadedAtIso());
  form.append("content_type", contentType);
  form.append("source", "firebase-water");
  if (meta?.householdId) form.append("householdId", meta.householdId);
  if (meta?.periodId) form.append("periodId", meta.periodId);
  if (meta?.householdCode) form.append("householdCode", meta.householdCode);
  if (meta?.confirmedValue != null) form.append("confirmedValue", String(meta.confirmedValue));

  const res = await fetch(webhookUrl, {
    method: "POST",
    body: form,
  });

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new Error(`n8n webhook HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const url = extractUrlFromN8nResponse(parsed);
  if (!url) {
    throw new Error(
      "n8n webhook không trả link ảnh. Cần trường url hoặc webContentLink (Google Drive) trong JSON response."
    );
  }

  return { url, raw: parsed };
}
