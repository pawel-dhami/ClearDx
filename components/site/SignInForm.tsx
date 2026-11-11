"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { authEnabled, googleEnabled, safeNext } from "@/lib/supabase/config";

const ERRORS: Record<string, string> = {
  link: "That sign-in link wasn't valid. Sign in with your password or request a new link.",
  expired: "That sign-in link has expired or was already used.",
};

type Mode = "signin" | "signup" | "link";

/** Email + password (default), optional emailed link, optional Google. */
export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "link" | "confirm">(null);
  const [message, setMessage] = useState<string | null>(ERRORS[params.get("error") ?? ""] ?? null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.push(next);
        return;
      }
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo() } });
        if (error) throw error;
        // With email confirmation off in Supabase, sign-up returns a session straight away.
        if (data.session) {
          router.push(next);
          return;
        }
        setSent("confirm");
        return;
      }
      const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
      if (error) throw error;
      setSent("link");
    } catch (err) {
      const m = (err as Error).message ?? "Something went wrong.";
      setMessage(/rate limit/i.test(m) ? "Too many emails were sent recently. Use email + password instead, or try again later." : /invalid login/i.test(m) ? "Email or password is incorrect." : m);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setMessage(null);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) setMessage(error.message);
  };

  if (!authEnabled) {
    return (
      <p className="text-soft">
        Sign-in isn&apos;t set up on this deployment yet. You can still use the{" "}
        <Link href="/app" className="text-cyan underline">
          app
        </Link>{" "}
        without an account.
      </p>
    );
  }

  if (sent) {
    return (
      <div role="status" className="space-y-3">
        <p className="font-display text-2xl font-semibold">Check your email</p>
        <p className="text-soft">
          {sent === "link" ? "We sent a sign-in link to " : "Confirm your account using the link we sent to "}
          <span className="text-text">{email}</span>.
        </p>
        <button type="button" onClick={() => setSent(null)} className="btn btn-ghost">
          Back
        </button>
      </div>
    );
  }

  const tabs: { m: Mode; label: string }[] = [
    { m: "signin", label: "Sign in" },
    { m: "signup", label: "Create account" },
  ];

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-full bg-fill p-0.5">
        {tabs.map((t) => (
          <button
            key={t.m}
            type="button"
            role="tab"
            aria-selected={mode === t.m}
            onClick={() => (setMode(t.m), setMessage(null))}
            className={`min-h-9 rounded-full text-sm font-medium transition-all ${mode === t.m ? "bg-raised text-text shadow-[0_1px_3px_rgb(0_0_0/0.18)]" : "text-muted hover:text-text"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <p role="alert" className="rounded-xl bg-contra/10 px-3 py-2 text-sm text-contra">
          {message}
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="label block">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-xl bg-fill px-3.5 text-text placeholder:text-faint focus:outline-2 focus:outline-[var(--accent)]"
          />
        </div>
        {mode !== "link" && (
          <div className="space-y-1.5">
            <label htmlFor="password" className="label block">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-xl bg-fill px-3.5 text-text focus:outline-2 focus:outline-[var(--accent)]"
            />
            {mode === "signup" && <p className="text-xs text-soft">At least 8 characters.</p>}
          </div>
        )}
        <button type="submit" disabled={busy || !email || (mode !== "link" && password.length < 8)} className="btn btn-primary h-11 w-full">
          {busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Email me a sign-in link"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {mode === "link" ? (
          <button type="button" onClick={() => setMode("signin")} className="text-cyan hover:underline">
            Use a password instead
          </button>
        ) : (
          <button type="button" onClick={() => setMode("link")} className="text-soft hover:text-cyan">
            Email me a link instead
          </button>
        )}
      </div>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="label">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={google} className="btn btn-ghost h-11 w-full">
            Continue with Google
          </button>
        </>
      )}

      <p className="text-sm text-soft">
        Signing in is optional. It saves your analyses and reports to your history. The app works fully without an account.
      </p>
    </div>
  );
}
