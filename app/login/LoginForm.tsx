"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountToAuthEmail } from "@/lib/accountEmail";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

function UserIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 11V8a4 4 0 1 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-.58M9.88 5.09A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a18.45 18.45 0 0 1-4.06 5.12M6.11 6.11A18.5 18.5 0 0 0 2 12s3 7 10 7a10.66 10.66 0 0 0 5.17-1.32"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="label" htmlFor="phone">
          Tài khoản
        </label>
        <div className="login-field">
          <span className="login-field-icon">
            <UserIcon />
          </span>
          <input
            id="phone"
            className="login-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Tài khoản hoặc số điện thoại"
            autoComplete="username"
            required
          />
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Đăng nhập bằng tài khoản được cấp.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <div className="login-field">
          <span className="login-field-icon">
            <LockIcon />
          </span>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className="login-input login-input-with-action"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="login-field-action"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            <EyeIcon off={!showPassword} />
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger)]/8 px-3.5 py-2.5 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-primary login-submit w-full" disabled={loading}>
        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
