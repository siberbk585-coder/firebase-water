import { buildImageFilename, uploadedAtIso } from "./filename";
import { extractUrlFromN8nResponse } from "./n8nLink";

export type N8nInvoiceUploadResult = {
  url: string;
  raw?: unknown;
};

export function n8nInvoiceWebhookUrl(): string | null {
  if (process.env.N8N_INVOICE_WEBHOOK_DISABLED === "true") return null;
  const url = process.env.N8N_INVOICE_WEBHOOK_URL?.trim();
  return url || null;
}

export type InvoicePdfUploadMeta = {
  invoiceId: string;
  householdId: string;
  periodId: string;
  householdCode: string;
  meterCode: string;
  periodLabel: string;
  totalAmount: number;
};

/** Gửi PDF hóa đơn lên n8n `Hoadon` — workflow trả link (Drive/url). */
export async function postInvoicePdfToN8nWebhook(
  buffer: Buffer,
  meta: InvoicePdfUploadMeta
): Promise<N8nInvoiceUploadResult> {
  const webhookUrl = n8nInvoiceWebhookUrl();
  if (!webhookUrl) {
    throw new Error("Chưa bật webhook n8n lưu hóa đơn (N8N_INVOICE_WEBHOOK_URL)");
  }

  const filename = buildImageFilename({
    prefix: "invoice",
    code: meta.householdCode,
    ext: "pdf",
  });

  const form = new FormData();
  form.append("pdf", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), filename);
  form.append("filename", filename);
  form.append("uploaded_at", uploadedAtIso());
  form.append("content_type", "application/pdf");
  form.append("source", "firebase-water");
  form.append("invoiceId", meta.invoiceId);
  form.append("householdId", meta.householdId);
  form.append("periodId", meta.periodId);
  form.append("householdCode", meta.householdCode);
  form.append("meterCode", meta.meterCode);
  form.append("periodLabel", meta.periodLabel);
  form.append("totalAmount", String(Math.round(meta.totalAmount)));

  const res = await fetch(webhookUrl, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    let hint = text.slice(0, 200);
    if (/workflow execution failed/i.test(text)) {
      hint +=
        " — Kiểm tra Executions trên n8n: file PDF rỗng, node Drive chưa map $binary.pdf.";
    }
    throw new Error(`n8n Hoadon webhook HTTP ${res.status}: ${hint}`);
  }

  const url = extractUrlFromN8nResponse(parsed);
  if (!url) {
    throw new Error(
      "n8n webhook Hoadon không trả link PDF. Cần trường url hoặc webContentLink trong JSON response."
    );
  }

  return { url, raw: parsed };
}
