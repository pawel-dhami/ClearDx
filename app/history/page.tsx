"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReportButton } from "@/components/app/ReportButton";
import { SeverityTag } from "@/components/app/Predictions";
import { Disclaimer } from "@/components/Disclaimer";
import { PanelTitle } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";
import { pct } from "@/lib/explain";
import { deleteAnalysis, listAnalyses, type SavedAnalysis } from "@/lib/history";
import type { Duration, Sex } from "@/lib/predict/types";
import { authEnabled } from "@/lib/supabase/config";
import { useSession } from "@/lib/useSession";

export default function HistoryPage() {
  const { user, ready } = useSession();
  const [items, setItems] = useState<SavedAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="mb-8 font-display text-4xl font-semibold">Your history</h1>

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
            {items.map((a) => {
              const top = [...a.result.predictions].sort((x, y) => y.confidence - x.confidence)[0];
              return (
                <li key={a.id} className="hud flex flex-wrap items-center gap-5 p-5">
                  <span className="w-20 shrink-0 font-mono text-3xl font-bold text-cyan">{a.top_confidence != null ? `${pct(a.top_confidence)}%` : "—"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <PanelTitle>{new Date(a.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</PanelTitle>
                      <span className="rounded-full bg-amber/12 px-2 py-0.5 text-[11px] font-semibold text-amber">{a.source === "mock" ? "Demo mode" : "Live model"}</span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="font-display text-xl font-semibold">{a.top_condition ?? "No match"}</span>
                      {top && <SeverityTag severity={top.severity} />}
                    </p>
                    <p className="mt-1 truncate text-sm text-soft">
                      {a.input.symptoms.join(" · ")} · age {a.input.age} · {a.input.duration}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReportButton
                      response={{ source: a.source, result: a.result }}
                      symptoms={a.input.symptoms}
                      excluded={a.input.excluded ?? []}
                      noEffect={a.input.noEffect ?? []}
                      age={a.input.age}
                      sex={a.input.sex as Sex}
                      duration={a.input.duration as Duration}
                      answers={a.input.answers ?? []}
                    />
                    <button type="button" onClick={() => remove(a.id)} className="btn btn-ghost !min-h-8 !px-3 hover:!border-contra hover:!text-contra" aria-label="Delete this saved analysis">
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Disclaimer className="mx-4 mb-4 sm:mx-8" />
    </div>
  );
}
