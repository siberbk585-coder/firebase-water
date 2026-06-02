"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountToAuthEmail } from "@/lib/accountEmail";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function tryLegacyLogin(account: string, pwd: string): Promise<boolean> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: account, password: pwd }),
    });
    return res.ok;
  }

  async function tryFirebaseLogin(account: string, pwd: string): Promise<boolean> {
    const email = accountToAuthEmail(account);
    const auth = getFirebaseAuth();
    const cred = await signInWithEmailAndPassword(auth, email, pwd);
    const idToken = await cred.user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (res.status === 403) {
      await signOut(auth);
      setError("Tài khoản chưa được cấp quyền trong hệ thống");
      return false;
    }
    if (!res.ok) {
      await signOut(auth);
      return false;
    }
    return true;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const account = phone.trim();

    try {
      if (await tryLegacyLogin(account, password)) {
        router.push("/");
        router.refresh();
        return;
      }
      if (await tryFirebaseLogin(account, password)) {
        router.push("/");
        router.refresh();
        return;
      }
      setError("Sai tài khoản hoặc mật khẩu");
    } catch {
      if (await tryLegacyLogin(account, password)) {
        router.push("/");
        router.refresh();
        return;
      }
      setError("Sai tài khoản hoặc mật khẩu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="phone">
          Tài khoản
        </label>
        <input
          id="phone"
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="admin hoặc 0912345678"
          autoComplete="username"
          required
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Admin: <code className="text-[var(--foreground)]">admin</code> · Hộ dân: số điện thoại đăng ký
        </p>
      </div>
      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={loading}>
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
