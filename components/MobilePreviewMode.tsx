"use client";

import { useEffect } from "react";

const STORAGE_KEY = "water-mobile-preview";

export function MobilePreviewMode() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("mobile");
    if (requested === "1") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else if (requested === "0") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    const enabled = window.localStorage.getItem(STORAGE_KEY) === "1";
    document.body.classList.toggle("mobile-preview", enabled);
    document.documentElement.classList.toggle("mobile-preview", enabled);

    return () => {
      document.body.classList.remove("mobile-preview");
      document.documentElement.classList.remove("mobile-preview");
    };
  }, []);

  return null;
}
