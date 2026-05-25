"use client";

import { useTransition } from "react";
import { updateHouseholdPaymentMethod } from "../households/actions";

type Method = "CASH" | "BANK_TRANSFER";

const LABEL: Record<Method, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

const STYLE: Record<Method, string> = {
  CASH: "bg-amber-100 text-amber-800 border-amber-200",
  BANK_TRANSFER: "bg-blue-100 text-blue-700 border-blue-200",
};

export function PaymentMethodSelect({
  householdId,
  value,
}: {
  householdId: string;
  value: Method;
}) {
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Method;
    const fd = new FormData();
    fd.set("paymentMethod", next);
    startTransition(() => {
      void updateHouseholdPaymentMethod(householdId, fd);
    });
  }

  return (
    <select
      defaultValue={value}
      disabled={pending}
      onChange={handleChange}
      className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold outline-none transition-opacity disabled:opacity-50 ${STYLE[value]}`}
    >
      <option value="CASH">{LABEL.CASH}</option>
      <option value="BANK_TRANSFER">{LABEL.BANK_TRANSFER}</option>
    </select>
  );
}
