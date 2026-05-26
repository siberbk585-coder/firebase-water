"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Ctx = {
  selectedIds: Set<string>;
  toggle: (householdId: string) => void;
  toggleMany: (householdIds: string[], on: boolean) => void;
  clear: () => void;
};

const BillingPrintSelectionContext = createContext<Ctx | null>(null);

export function BillingPrintSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((householdId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(householdId)) next.delete(householdId);
      else next.add(householdId);
      return next;
    });
  }, []);

  const toggleMany = useCallback((householdIds: string[], on: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of householdIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const value = useMemo(
    () => ({ selectedIds, toggle, toggleMany, clear }),
    [selectedIds, toggle, toggleMany, clear]
  );

  return (
    <BillingPrintSelectionContext.Provider value={value}>
      {children}
    </BillingPrintSelectionContext.Provider>
  );
}

export function useBillingPrintSelection() {
  const ctx = useContext(BillingPrintSelectionContext);
  if (!ctx) {
    throw new Error("useBillingPrintSelection cần BillingPrintSelectionProvider");
  }
  return ctx;
}

export function useBillingPrintSelectionOptional() {
  return useContext(BillingPrintSelectionContext);
}
