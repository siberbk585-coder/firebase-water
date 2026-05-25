"use client";

import { useState } from "react";
import { SendInvoiceButton } from "./SendInvoiceButton";

type Props = {
  invoiceId: string;
  sendCount: number;
  lastSentAt: Date | null;
  paid: boolean;
  isBankTransfer: boolean;
};

const COUNT_LABEL: Record<number, string> = { 0: "Chưa gửi HĐ", 1: "Gửi lần 1", 2: "Gửi lần 2" };

function sendLabel(count: number) {
  return COUNT_LABEL[count] ?? `Gửi lần ${count}`;
}

function sendBadgeStyle(count: number) {
  if (count === 0) return "bg-slate-100 text-slate-500";
  if (count === 1) return "bg-blue-100 text-blue-700";
  return "bg-orange-100 text-orange-700";
}

export function SendStatusBadge({ invoiceId, sendCount: initialCount, lastSentAt: initialSentAt, paid, isBankTransfer }: Props) {
  const [count, setCount] = useState(initialCount);
  const [lastSentAt, setLastSentAt] = useState(initialSentAt);

  if (paid) {
    return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Đã thanh toán</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${sendBadgeStyle(count)}`}>
        {sendLabel(count)}
      </span>
      {lastSentAt && (
        <span className="text-[10px] text-slate-400">
          {new Date(lastSentAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
      {isBankTransfer && (
        <SendInvoiceButton
          invoiceId={invoiceId}
          onSent={() => {
            setCount((c) => c + 1);
            setLastSentAt(new Date());
          }}
        />
      )}
    </div>
  );
}
