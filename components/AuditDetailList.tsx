import type { AuditDetailLine } from "@/lib/auditDisplay";

export function AuditDetailList({ lines }: { lines: AuditDetailLine[] }) {
  if (!lines.length) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  return (
    <ul className="space-y-0.5 text-xs leading-relaxed">
      {lines.map((line) => (
        <li key={line.label}>
          <span className="text-[var(--muted)]">{line.label}:</span>{" "}
          <span className="font-medium text-[var(--foreground)]">{line.value}</span>
        </li>
      ))}
    </ul>
  );
}
