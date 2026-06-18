import Link from "next/link";
import { parseAnomalyFlags } from "@/lib/anomaly";
import { formatCurrency } from "@/lib/billing";
import type { HouseholdPeriodBundle } from "@/lib/householdPeriod";
import {
  anomalyLabel,
  formatPeriod,
  inputMethodLabel,
  invoiceStatusLabel,
  paymentMethodLabel,
  periodStatusLabel,
  readingStatusLabel,
} from "@/lib/vi";

export function HouseholdPeriodPanel({
  row,
  defaultOpen = false,
}: {
  row: HouseholdPeriodBundle;
  defaultOpen?: boolean;
}) {
  const { period, reading, invoice } = row;
  const flags = reading ? parseAnomalyFlags(reading.anomalyFlags) : [];
  const periodLabel = formatPeriod(period.month, period.year);

  const summaryParts: string[] = [];
  if (reading) {
    summaryParts.push(
      `${reading.oldReading}→${reading.confirmedValue ?? "?"}`,
      reading.usageM3 != null ? `${reading.usageM3} m³` : "— m³"
    );
  } else {
    summaryParts.push("Chưa gửi chỉ số");
  }
  if (invoice) {
    summaryParts.push(formatCurrency(invoice.totalAmount));
    summaryParts.push(invoiceStatusLabel(invoice.status));
  } else {
    summaryParts.push("Chưa có HĐ");
  }

  return (
    <details className="period-accordion group" open={defaultOpen}>
      <summary className="period-accordion-summary">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <span className="font-semibold text-[var(--foreground)]">{periodLabel}</span>
          <span
            className={
              period.status === "OPEN"
                ? "badge bg-[var(--primary-soft)] text-[var(--primary-dark)]"
                : "badge bg-slate-100 text-slate-600"
            }
          >
            {periodStatusLabel(period.status)}
          </span>
          {reading?.status === "PENDING" && (
            <span className="badge badge-warning">Chờ duyệt</span>
          )}
          <span className="text-sm text-[var(--muted)]">{summaryParts.join(" · ")}</span>
        </span>
        <span className="period-chevron text-[var(--muted)]" aria-hidden>
          ▼
        </span>
      </summary>

      <div className="period-accordion-body">
        <div className="grid gap-4 lg:grid-cols-2">
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Chỉ số đồng hồ
            </h3>
            {reading ? (
              <dl className="detail-grid text-sm">
                <Dt>Trạng thái</Dt>
                <Dd>{readingStatusLabel(reading.status)}</Dd>
                <Dt>Chỉ số cũ → mới</Dt>
                <Dd>
                  {reading.oldReading} → {reading.confirmedValue ?? "—"}
                </Dd>
                <Dt>Tiêu thụ</Dt>
                <Dd>{reading.usageM3 != null ? `${reading.usageM3} m³` : "—"}</Dd>
                <Dt>OCR / độ tin cậy</Dt>
                <Dd>
                  {reading.ocrValue ?? "—"}
                  {reading.confidence != null && ` (${reading.confidence.toFixed(0)}%)`}
                </Dd>
                <Dt>Cách nhập</Dt>
                <Dd>{reading.inputMethod ? inputMethodLabel(reading.inputMethod) : "—"}</Dd>
                <Dt>Cảnh báo</Dt>
                <Dd>
                  {flags.length ? (
                    <span className="badge badge-warning">{flags.map(anomalyLabel).join(", ")}</span>
                  ) : (
                    "—"
                  )}
                </Dd>
                <Dt>Gửi / xác nhận</Dt>
                <Dd>
                  {reading.submittedAt.toLocaleString("vi-VN")}
                  {reading.confirmedAt && (
                    <>
                      <br />
                      <span className="text-[var(--muted)]">
                        Xác nhận: {reading.confirmedAt.toLocaleString("vi-VN")}
                      </span>
                    </>
                  )}
                </Dd>
                {reading.imagePath && (
                  <>
                    <Dt>Ảnh đồng hồ</Dt>
                    <Dd className="font-mono text-xs">{reading.imagePath}</Dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-[var(--muted)]">Hộ chưa gửi chỉ số kỳ này.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Hóa đơn & thanh toán
            </h3>
            {invoice ? (
              <dl className="detail-grid text-sm">
                <Dt>Trạng thái HĐ</Dt>
                <Dd>{invoiceStatusLabel(invoice.status)}</Dd>
                <Dt>Tiêu thụ / đơn giá</Dt>
                <Dd>
                  {invoice.usageM3} m³ ×{" "}
                  {invoice.unitPrice.toLocaleString("vi-VN")} đ/m³ (gồm VAT)
                </Dd>
                <Dt>Tổng tiền</Dt>
                <Dd className="font-semibold text-[var(--primary-dark)]">
                  {formatCurrency(invoice.totalAmount)}
                </Dd>
                <Dt>Ngày phát hành</Dt>
                <Dd>{invoice.issuedAt?.toLocaleString("vi-VN") ?? "—"}</Dd>
                {invoice.pdfPath && (
                  <>
                    <Dt>Hóa đơn PDF</Dt>
                    <Dd>
                      <Link
                        href={`/invoice/${invoice.id}`}
                        className="font-semibold text-[var(--primary)] hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Xem trực tiếp
                      </Link>
                    </Dd>
                  </>
                )}
                {invoice.payment ? (
                  <>
                    <Dt>Thanh toán</Dt>
                    <Dd>
                      {formatCurrency(invoice.payment.amount)} —{" "}
                      {paymentMethodLabel(invoice.payment.method)}
                      {invoice.payment.confirmedAt && (
                        <span className="block text-[var(--muted)]">
                          {invoice.payment.confirmedAt.toLocaleString("vi-VN")}
                        </span>
                      )}
                    </Dd>
                  </>
                ) : invoice.status === "ISSUED" ? (
                  <>
                    <Dt>Thanh toán</Dt>
                    <Dd>
                      <span className="badge badge-warning">Chưa xác nhận TT</span>
                    </Dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Chưa phát hành hóa đơn
                {reading?.status === "CONFIRMED" ? " (có thể tạo từ màn Hóa đơn)." : "."}
              </p>
            )}
          </section>
        </div>
      </div>
    </details>
  );
}

function Dt({ children }: { children: React.ReactNode }) {
  return <dt className="text-[var(--muted)]">{children}</dt>;
}

function Dd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={className ?? ""}>{children}</dd>;
}
