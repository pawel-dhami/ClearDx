"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { Corners } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";
import { SignInForm } from "@/components/site/SignInForm";

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
