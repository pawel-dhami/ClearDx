"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { Corners } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";
import { getSupabase } from "@/lib/supabase/client";
import { authEnabled, safeNext } from "@/lib/supabase/config";

const ERRORS: Record<string, string> = {
  link: "That sign-in link wasn't valid. Request a new one below.",
  expired: "That sign-in link has expired or was already used. Request a new one below.",
};

function SignInForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(ERRORS[params.get("error") ?? ""] ?? null);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setState("sending");
    setMessage(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else setState("sent");
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

  if (state === "sent") {
    return (
      <div role="status" className="space-y-3">
        <p className="font-display text-2xl font-bold tracking-[0.05em] uppercase">Check your email</p>
        <p className="text-soft">
          We sent a sign-in link to <span className="text-text">{email}</span>. Open it on this device to finish signing in.
        </p>
        <button type="button" onClick={() => setState("idle")} className="btn btn-ghost">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <p role="alert" className="border border-contra/50 bg-contra/7 px-3 py-2 text-sm">
          {message}
        </p>
      )}
      <form onSubmit={sendLink} className="space-y-3">
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
          placeholder="you@example.com"
          className="h-11 w-full border border-line bg-ink/60 px-3 text-text placeholder:text-faint focus:border-cyan"
        />
        <button type="submit" disabled={state === "sending" || !email} className="btn btn-primary h-11 w-full">
          {state === "sending" ? "Sending link…" : "Email me a sign-in link"}
        </button>
      </form>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="label">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <button type="button" onClick={google} className="btn btn-ghost h-11 w-full">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.7h5.4a4.6 4.6 0 0 1-2 3.03v2.5h3.24c1.9-1.75 2.96-4.33 2.96-7.27ZM12 22c2.7 0 4.97-.9 6.63-2.43l-3.24-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Zm-5.6-8.09a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.34-2.59ZM12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5L6.4 10.1C7.19 7.72 9.4 5.95 12 5.95Z" />
        </svg>
        Continue with Google
      </button>
      <p className="text-sm text-soft">
        Signing in is optional. It saves your analyses and reports to your history. The app works fully without an account.
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Nav
        right={
          <Link href="/app" className="btn btn-primary">
            Launch app
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
        <section aria-labelledby="signin-title" className="hud p-8">
          <Corners />
          <p className="label mb-2">Account</p>
          <h1 id="signin-title" className="mb-6 font-display text-4xl font-bold tracking-[0.05em] uppercase">
            Sign in
          </h1>
          <Suspense fallback={<div className="skeleton h-40" aria-hidden />}>
            <SignInForm />
          </Suspense>
        </section>
      </main>
      <Disclaimer className="mx-4 mb-4 sm:mx-8" />
    </div>
  );
}
