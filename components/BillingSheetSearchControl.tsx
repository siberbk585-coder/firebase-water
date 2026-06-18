"use client";

import { useEffect, useRef, useState } from "react";
import { BILLING_SHEET_SEARCH_EVENT } from "@/lib/billingSheetSearch";

const SEARCH_DEBOUNCE_MS = 320;

export function BillingSheetSearchControl({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const [inputValue, setInputValue] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function publishNow(nextQuery: string) {
    setInputValue(nextQuery);
    const url = new URL(window.location.href);
    const trimmed = nextQuery.trim();
    if (trimmed) url.searchParams.set("q", trimmed);
    else url.searchParams.delete("q");
    const search = url.searchParams.toString();
    window.history.replaceState(null, "", search ? `${url.pathname}?${search}` : url.pathname);
    window.dispatchEvent(
      new CustomEvent(BILLING_SHEET_SEARCH_EVENT, {
        detail: { query: trimmed },
      })
    );
  }

  function schedulePublish(nextQuery: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      publishNow(nextQuery);
    }, SEARCH_DEBOUNCE_MS);
  }

  function onInputChange(nextQuery: string) {
    setInputValue(nextQuery);
    schedulePublish(nextQuery);
  }

  return (
    <form
      className="billing-search-control flex items-end gap-1 max-md:grid max-md:w-full max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-stretch max-md:gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        publishNow(inputValue);
      }}
    >
      <input
        name="q"
        value={inputValue}
        placeholder="Tìm MKH, đồng hồ, tên…"
        className="input billing-search-input py-1.5 text-sm max-md:w-full"
        aria-label="Tìm mã hộ, đồng hồ, tên"
        autoComplete="off"
        onChange={(e) => onInputChange(e.target.value)}
      />
      <button type="submit" className="btn btn-secondary py-1.5 text-xs">
        Tìm
      </button>
      {inputValue.trim() && (
        <button
          type="button"
          className="btn btn-secondary px-2 py-1.5 text-xs"
          title="Xóa lọc"
          onClick={() => publishNow("")}
        >
          ×
        </button>
      )}
    </form>
  );
}
