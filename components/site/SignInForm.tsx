"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { authEnabled, googleEnabled, safeNext } from "@/lib/supabase/config";

const ERRORS: Record<string, string> = {
  link: "That sign-in link wasn't valid. Sign in with your password or request a new link.",
  expired: "That link has expired or was already used. Sign in, or request a new one.",
};

type Mode = "signin" | "signup" | "link";
type Sent = null | "link" | "confirm";

const HEADINGS: Record<Mode, { title: string; sub: string }> = {
  signin: { title: "Welcome back", sub: "Sign in to see your saved analyses and patients." },
  signup: { title: "Create your account", sub: "Save analyses, keep patients together and download reports any time." },
  link: { title: "Get a sign-in link", sub: "We'll email you a link that signs you in, no password needed." },
};

/** Google's standard multicolour "G" mark (brand guidelines: shown unmodified beside "Continue with Google"). */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** Google first, then email + password (sign in / create account), with an emailed link as the no-password path. */
export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [sent, setSent] = useState<Sent>(null);
  const [message, setMessage] = useState<string | null>(ERRORS[params.get("error") ?? ""] ?? null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resend, setResend] = useState<"idle" | "busy" | "done">("idle");
  const ids = { email: useId(), password: useId(), hint: useId() };

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const switchMode = (m: Mode) => {
    setMode(m);
    setMessage(null);
    setUnconfirmed(false);
  };

  const friendly = (m: string) =>
    /rate limit/i.test(m)
      ? "Too many emails were sent recently. Please wait a few minutes and try again."
      : /invalid login/i.test(m)
        ? "Email or password is incorrect."
        : /already registered|already been registered/i.test(m)
          ? "An account with this email already exists. Sign in instead."
          : /signups not allowed|user not found/i.test(m)
            ? "There's no account with that email yet. Create one instead."
            : m;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setMessage(null);
    setUnconfirmed(false);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          if (/not confirmed/i.test(error.message)) {
            setUnconfirmed(true);
            setMessage("Please confirm your email first. Check your inbox for the link we sent when you signed up.");
            return;
          }
          throw error;
        }
        router.push(next);
        return;
      }
      if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo() } });
        if (error) throw error;
        // If email confirmation is off in Supabase, sign-up returns a session straight away.
        if (data.session) {
          router.push(next);
          return;
        }
        setResend("idle");
        setSent("confirm");
        return;
      }
      const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: false } });
      if (error) throw error;
      setSent("link");
    } catch (err) {
      setMessage(friendly((err as Error).message ?? "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setResend("busy");
    const { error } = await sb.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    if (error) {
      setResend("idle");
      setMessage(friendly(error.message));
      return;
    }
    setResend("done");
  };

  const google = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setMessage(null);
    setGoogleBusy(true);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) {
      setGoogleBusy(false);
      setMessage(error.message);
    }
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

  // ---------- "check your inbox" ----------
  if (sent) {
    return (
      <div role="status" className="flex flex-col items-center gap-4 py-2 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-cyan/15 text-cyan">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </span>
        <div>
          <p className="font-display text-2xl font-semibold">Check your inbox</p>
          <p className="mt-1.5 text-sm text-soft">
            {sent === "link" ? "We sent a sign-in link to " : "We sent a confirmation link to "}
            <span className="font-medium text-text">{email}</span>.
            {sent === "confirm" && " Open it to activate your account, then you're signed in."}
          </p>
          <p className="mt-2 text-xs text-muted">It can take a minute. Check your spam folder if you don&apos;t see it.</p>
        </div>
        {message && (
          <p role="alert" className="w-full rounded-xl bg-contra/10 px-3 py-2 text-sm text-contra">
            {message}
          </p>
        )}
        <div className="flex w-full flex-col gap-2">
          {sent === "confirm" && (
            <button type="button" onClick={resendConfirmation} disabled={resend !== "idle"} className="btn btn-ghost h-11 w-full">
              {resend === "busy" ? "Sending…" : resend === "done" ? "Email sent again" : "Resend email"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setMessage(null);
            }}
            className="h-9 rounded-full text-sm font-medium text-muted transition-colors hover:text-text"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  const tabs: { m: Mode; label: string }[] = [
    { m: "signin", label: "Sign in" },
    { m: "signup", label: "Create account" },
  ];
  const field =
    "h-11 w-full rounded-xl bg-fill px-3.5 text-text outline-none placeholder:text-muted focus-visible:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-shadow";
  const h = HEADINGS[mode];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[28px] leading-tight font-semibold">{h.title}</h2>
        <p className="mt-1 text-sm text-soft">{h.sub}</p>
      </div>

      {mode !== "link" && (
        <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-full bg-fill p-0.5">
          {tabs.map((t) => (
            <button
              key={t.m}
              type="button"
              role="tab"
              aria-selected={mode === t.m}
              onClick={() => switchMode(t.m)}
              className={`min-h-9 rounded-full text-sm font-medium transition-all ${mode === t.m ? "bg-raised text-text shadow-[0_1px_3px_rgb(0_0_0/0.18)]" : "text-muted hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {googleEnabled && mode !== "link" && (
        <>
          <button
            type="button"
            onClick={google}
            disabled={googleBusy}
            className="flex h-11 w-full items-center justify-center gap-3 rounded-full bg-white px-4 text-[15px] font-medium text-[#1f1f1f] shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-[#dadce0] transition-colors hover:bg-[#f7f8f8] disabled:opacity-60"
          >
            <GoogleLogo />
            {googleBusy ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-muted">or continue with email</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      {message && (
        <div role="alert" className="space-y-2 rounded-xl bg-contra/10 px-3.5 py-2.5 text-sm text-contra">
          <p>{message}</p>
          {unconfirmed && (
            <button type="button" onClick={resendConfirmation} disabled={resend !== "idle"} className="font-medium text-text underline-offset-2 hover:underline disabled:opacity-60">
              {resend === "busy" ? "Sending…" : resend === "done" ? "Confirmation email sent again" : "Resend confirmation email"}
            </button>
          )}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3.5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor={ids.email} className="label block">
            Email
          </label>
          <input
            id={ids.email}
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </div>
        {mode !== "link" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={ids.password} className="label block">
                Password
              </label>
              {mode === "signin" && (
                <button type="button" onClick={() => switchMode("link")} className="text-xs font-medium text-cyan hover:underline">
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id={ids.password}
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                aria-describedby={mode === "signup" ? ids.hint : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${field} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-1 my-auto grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-text"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {mode === "signup" && (
              <p id={ids.hint} className={`text-xs ${password && password.length < 8 ? "text-amber" : "text-muted"}`}>
                At least 8 characters{password ? ` · ${Math.min(password.length, 8)}/8` : ""}. We&apos;ll email you a link to confirm your address.
              </p>
            )}
          </div>
        )}
        <button type="submit" disabled={busy || !email || (mode !== "link" && password.length < 8)} className="btn btn-primary h-11 w-full !text-[15px]">
          {busy ? "Working…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Email me a sign-in link"}
        </button>
      </form>

      <p className="text-center text-sm text-soft">
        {mode === "link" ? (
          <button type="button" onClick={() => switchMode("signin")} className="font-medium text-cyan hover:underline">
            Back to sign in with a password
          </button>
        ) : mode === "signin" ? (
          <>
            No account yet?{" "}
            <button type="button" onClick={() => switchMode("signup")} className="font-medium text-cyan hover:underline">
              Create one
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" onClick={() => switchMode("signin")} className="font-medium text-cyan hover:underline">
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
