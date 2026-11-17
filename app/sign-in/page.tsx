"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { LogoMark } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";
import { SignInForm } from "@/components/site/SignInForm";

const BENEFITS = [
  {
    title: "Your history, saved",
    body: "Every analysis is kept so you can come back to it, on any device.",
    icon: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7M21 4v4h-4" />,
  },
  {
    title: "Patients in one place",
    body: "Add patients and keep each person's analyses together.",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.5.8 2.5 2.6 3 5.2" />
      </>
    ),
  },
  {
    title: "Reports any time",
    body: "Download a PDF report for any saved analysis, whenever you need it.",
    icon: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  },
];

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
      <main className="mx-auto grid w-full max-w-[1040px] flex-1 items-center gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_440px] lg:py-16">
        {/* ---------- why sign in (wide screens) ---------- */}
        <section aria-labelledby="why-title" className="hidden lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-fill px-3 py-1 text-[13px] font-medium text-soft">
            <LogoMark size={16} /> ClearDx account
          </span>
          <h1 id="why-title" className="mt-5 max-w-[16ch] font-display text-5xl leading-[1.05] font-semibold">
            Keep every analysis, and the reasons behind it.
          </h1>
          <ul className="mt-8 space-y-5">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan/12 text-cyan">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {b.icon}
                  </svg>
                </span>
                <span>
                  <span className="block font-medium text-text">{b.title}</span>
                  <span className="block text-sm text-soft">{b.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-8 flex max-w-[44ch] items-start gap-2.5 text-sm text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0" aria-hidden>
              <rect x="4" y="11" width="16" height="10" rx="2.5" />
              <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
            </svg>
            Private by design: only you can see your analyses and patients. Signing in is optional; the app works fully without an account.
          </p>
        </section>

        {/* ---------- form ---------- */}
        <section aria-label="Sign in or create an account" className="hud mx-auto w-full max-w-[440px] p-6 sm:p-8">
          <h1 className="sr-only lg:hidden">Sign in to ClearDx</h1>
          <Suspense fallback={<div className="skeleton h-80" aria-hidden />}>
            <SignInForm />
          </Suspense>
        </section>
      </main>
      <Disclaimer className="mx-4 mb-4 sm:mx-8" />
    </div>
  );
}
