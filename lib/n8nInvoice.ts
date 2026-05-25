import { buildTransferNote } from "./paymentQr";
import { formatPeriod } from "./vi";

export function n8nZaloWebhookUrl(): string | null {
  if (process.env.N8N_ZALO_WEBHOOK_DISABLED === "true") return null;
  const url = process.env.N8N_ZALO_WEBHOOK_URL?.trim();
  return url || null;
}

export type InvoiceZaloPayload = {
  invoiceId: string;
  householdCode: string;
  meterCode: string;
  periodMonth: number;
  periodYear: number;
  residentName: string;
  contactPhone?: string | null;
  periodLabel: string;
  totalAmount: number;
  usageM3: number;
  pdfUrl?: string | null;
  transferNote?: string;
};

/** Gửi hóa đơn qua n8n → Zalo OA + QR (workflow trên VPS). */
export async function sendInvoiceViaN8n(
  payload: InvoiceZaloPayload
): Promise<{ ok: boolean; messageId?: string; skipped?: boolean }> {
  const webhookUrl = n8nZaloWebhookUrl();
  if (!webhookUrl) {
    return { ok: true, skipped: true };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "firebase-water",
      ...payload,
      pdfUrl: payload.pdfUrl ?? `${appUrl}/api/invoices/${payload.invoiceId}/pdf`,
      transferNote:
        payload.transferNote ??
        buildTransferNote(payload.meterCode, payload.periodMonth, payload.periodYear),
      qrAmount: Math.round(payload.totalAmount),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`n8n Zalo webhook HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  let messageId: string | undefined;
  try {
    const parsed = JSON.parse(text) as { messageId?: string; zaloMessageId?: string };
    messageId = parsed.messageId ?? parsed.zaloMessageId;
  } catch {
    /* ignore */
  }

  return { ok: true, messageId };
}

export function periodLabelFromParts(month: number, year: number): string {
  return formatPeriod(month, year);
}
