"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisCard } from "@/components/app/AnalysisCard";
import { Disclaimer } from "@/components/Disclaimer";
import { Nav } from "@/components/site/Nav";
import { deleteAnalysis, listAnalyses, type SavedAnalysis } from "@/lib/history";
import { usePatients } from "@/lib/patients";
import { authEnabled } from "@/lib/supabase/config";
import { useSession } from "@/lib/useSession";

export default function HistoryPage() {
  const { user, ready } = useSession();
  const [items, setItems] = useState<SavedAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { patients } = usePatients(!!user);
  const names = new Map((patients ?? []).map((p) => [p.id, p.name]));

  useEffect(() => {
    if (!user) return;
    let alive = true;
    listAnalyses()
      .then((rows) => alive && setItems(rows))
      .catch((e) => alive && setError(e.message ?? "Couldn't load your history."));
    return () => {
      alive = false;
    };
  }, [user]);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this saved analysis? This can't be undone.")) return;
    try {
      await deleteAnalysis(id);
      setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Nav
        right={
          <Link href="/app" className="btn btn-primary">
            Launch app
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-8">
        <p className="label mb-2">Account</p>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-semibold">Your history</h1>
          {user && (
            <Link href="/patients" className="btn btn-ghost">
              Patients
            </Link>
          )}
        </div>

        {!authEnabled ? (
          <p className="text-soft">Sign-in isn&apos;t set up on this deployment, so there&apos;s no saved history.</p>
        ) : !ready ? (
          <div className="skeleton h-24" aria-hidden />
        ) : !user ? (
          <p className="text-soft">
            <Link href="/sign-in?next=/history" className="text-cyan underline">
              Sign in
            </Link>{" "}
            to see analyses you&apos;ve saved.
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-contra/10 px-3 py-2 text-sm text-contra">
            {error}
          </p>
        ) : items === null ? (
          <div className="space-y-3" aria-hidden>
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </div>
        ) : items.length === 0 ? (
          <section className="hud p-8 text-center">
            <p className="font-display text-2xl font-semibold">Nothing saved yet</p>
            <p className="mt-2 text-soft">Run an analysis while signed in and it will appear here.</p>
            <Link href="/app" className="btn btn-primary mt-6">
              Open the app
            </Link>
          </section>
        ) : (
          <ul className="space-y-3" aria-label="Saved analyses, newest first">
            {items.map((a) => (
              <AnalysisCard key={a.id} analysis={a} patientName={a.patient_id ? names.get(a.patient_id) : undefined} onDelete={remove} />
            ))}
          </ul>
        )}
      </main>
      <Disclaimer className="mx-4 mb-4 sm:mx-8" />
    </div>
  );
}
