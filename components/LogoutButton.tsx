"use client";

import { useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";

export function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (auth.currentUser) await signOut(auth);
    } catch {
      /* bỏ qua */
    }
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/logout";
    document.body.appendChild(form);
    form.submit();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={className ?? "btn btn-ghost text-sm"}
    >
      {loading ? "Đang thoát..." : "Đăng xuất"}
    </button>
  );
}
