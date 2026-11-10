"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BodyMap } from "@/components/body-map/BodyMap";
import { ContributionGraph, GraphLegend } from "@/components/ContributionGraph";
import { Disclaimer } from "@/components/Disclaimer";
import { FollowUpCards } from "@/components/FollowUpCards";
import { PredictionCards, PredictionCardsSkeleton } from "@/components/PredictionCards";
import { ProfileForm } from "@/components/ProfileForm";
import { ReasoningTimeline } from "@/components/ReasoningTimeline";
import { RedFlags } from "@/components/Results";
import { SymptomChips } from "@/components/SymptomChips";
import { Panel } from "@/components/ui/Panel";
import type { Highlight } from "@/lib/explain";
import { springs } from "@/lib/motion";
import type { Duration, FollowUpAnswer, PredictInput, Sex } from "@/lib/predict/types";
import { findSymptom, REGIONS, type Region } from "@/lib/symptoms";
import { inputKey, usePrediction } from "@/lib/usePrediction";

const WHAT_IF_DEBOUNCE_MS = 600;

export default function Home() {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [age, setAge] = useState(30);
  const [sex, setSex] = useState<Sex>("female");
  const [duration, setDuration] = useState<Duration>("1-3d");
  const [answers, setAnswers] = useState<FollowUpAnswer[]>([]);
  const [whatIf, setWhatIf] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const { response, previous, loading, error, run } = usePrediction();
  const revealResults = useRef(false);

  // After a manual Analyze on stacked layouts, bring the results into view once.
  useEffect(() => {
    if (!response || !revealResults.current) return;
    revealResults.current = false;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("predictions")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [response]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<Region, number>;
    for (const s of symptoms) {
      const region = findSymptom(s)?.region;
      if (region) c[region]++;
    }
    return c;
  }, [symptoms]);

  // Symptoms actually sent to the predictor (what-if can exclude some).
  const active = useMemo(
    () => (whatIf ? symptoms.filter((s) => !excluded.has(s)) : symptoms),
    [symptoms, excluded, whatIf],
  );
  const input: PredictInput = useMemo(
    () => ({ symptoms: active, age, sex, duration, answers }),
    [active, age, sex, duration, answers],
  );
  const key = inputKey(input);

  // What-if: any change to the input re-runs the prediction, debounced.
  useEffect(() => {
    if (!whatIf || input.symptoms.length === 0) return;
    const t = setTimeout(() => void run(input, { skipIfUnchanged: true }), WHAT_IF_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // `key` captures every field of `input`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatIf, key, run]);

  const toggleSymptom = (label: string) => {
    setSymptoms((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
    setExcluded((e) => {
      if (!e.has(label)) return e;
      const n = new Set(e);
      n.delete(label);
      return n;
    });
  };

  const toggleExcluded = (label: string) =>
    setExcluded((e) => {
      const n = new Set(e);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });

  const setWhatIfMode = (on: boolean) => {
    setWhatIf(on);
    if (!on) setExcluded(new Set());
  };

  const analyze = () => {
    revealResults.current = true;
    setAnswers([]);
    void run({ ...input, answers: [] });
  };

  const updateAnswers = (next: FollowUpAnswer[]) => {
    setAnswers(next);
    // In what-if mode the debounced effect picks this up; otherwise run now.
    if (!whatIf) void run({ ...input, answers: next });
  };
  const answer = (question: string, value: "yes" | "no") =>
    updateAnswers([...answers.filter((a) => a.question !== question), { question, answer: value }]);
  const undo = (question: string) => updateAnswers(answers.filter((a) => a.question !== question));

  const r = response?.result;
  const announcement = useMemo(() => {
    if (!r) return "";
    const top = [...r.predictions].sort((a, b) => b.confidence - a.confidence)[0];
    const flags = r.red_flags.length ? ` ${r.red_flags.length} red flag${r.red_flags.length === 1 ? "" : "s"}.` : "";
    return `Results updated. Top match: ${top.condition}, ${Math.round(top.confidence * 100)} percent.${flags}`;
  }, [r]);
  const highlightedSymptom = highlight?.kind === "symptom" ? highlight.id : null;

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-3 pt-5 pb-24 sm:px-6 sm:pb-28 lg:pt-10">
      <a
        href="#predictions"
        className="sr-only rounded-xl bg-surface px-4 py-2 text-sm text-neon-cyan focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to results
      </a>
      {/* One concise announcement per result, instead of re-reading every animated card. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
        className="mb-6 flex flex-wrap items-end justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div aria-hidden className="relative grid size-10 place-items-center rounded-2xl border border-neon-cyan/30 bg-neon-cyan/10">
            <span className="absolute inset-0 rounded-2xl bg-neon-cyan/20 blur-md" />
            <svg viewBox="0 0 24 24" className="relative size-5 text-neon-cyan" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 12h4l2-5 4 10 2-5h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              <span className="neon-text">Explainable</span> Symptom Predictor
            </h1>
            <p className="text-sm text-muted">See which symptoms drive each prediction, and why.</p>
          </div>
        </div>
        <AnimatePresence>
          {response && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springs.snappy}
              className={`rounded-full border px-3 py-1 text-xs ${
                response.source === "mock"
                  ? "border-neon-violet/40 bg-neon-violet/10 text-neon-violet"
                  : "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan"
              }`}
            >
              {response.source === "mock" ? "Mock mode · demo data" : "Live · Groq"}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.header>

      <motion.main
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12"
      >
        <Panel id="body" title="Body map" className="md:row-span-2 lg:col-span-5 lg:row-span-3 lg:self-start">
          <BodyMap selected={symptoms} counts={counts} scanning={loading} onToggle={toggleSymptom} />
        </Panel>

        <Panel id="profile" title="About you" accent="violet" className="lg:col-span-7">
          <ProfileForm age={age} sex={sex} duration={duration} onAge={setAge} onSex={setSex} onDuration={setDuration} />
        </Panel>

        <Panel
          id="symptoms"
          title={`Symptoms${symptoms.length ? ` · ${symptoms.length}` : ""}`}
          className="lg:col-span-7"
          aside={
            <div className="flex items-center gap-3">
              {symptoms.length > 0 && (
                <button
                  onClick={() => {
                    setSymptoms([]);
                    setExcluded(new Set());
                  }}
                  className="text-xs text-muted hover:text-contra"
                >
                  Clear all
                </button>
              )}
              <WhatIfSwitch on={whatIf} onChange={setWhatIfMode} />
            </div>
          }
        >
          <div className="flex h-full flex-col gap-4">
            <div className="flex-1">
              <SymptomChips
                symptoms={symptoms}
                onReorder={setSymptoms}
                onRemove={toggleSymptom}
                whatIf={whatIf}
                disabled={excluded}
                onToggleEnabled={toggleExcluded}
                highlighted={highlightedSymptom}
              />
            </div>
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
              <AnimatePresence mode="wait">
                <motion.p
                  key={whatIf ? "w" : "n"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={springs.snappy}
                  className="text-xs text-muted"
                >
                  {whatIf ? (
                    <>
                      <span className="text-neon-cyan">What-if is on.</span> Tap a symptom to leave it out; results
                      update live.
                      {excluded.size > 0 && ` ${excluded.size} excluded.`}
                    </>
                  ) : symptoms.length > 1 ? (
                    "Drag to rank by how much each bothers you."
                  ) : (
                    ""
                  )}
                </motion.p>
              </AnimatePresence>
              {!whatIf && (
                <motion.button
                  onClick={analyze}
                  disabled={symptoms.length === 0 || loading}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={springs.snappy}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-violet px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_10px_30px_-10px_rgba(94,234,212,.8)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                >
                  {loading && <span aria-hidden className="skeleton absolute inset-0 rounded-none! opacity-60" />}
                  <span className="relative">{loading ? "Analyzing…" : response ? "Re-analyze" : "Analyze symptoms"}</span>
                </motion.button>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          id="predictions"
          focusTarget
          title="Likely conditions"
          className="md:col-span-2 lg:col-span-7"
          aside={
            <AnimatePresence>
              {loading && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-xs text-neon-cyan"
                >
                  <span className="size-1.5 animate-ping rounded-full bg-neon-cyan" /> updating
                </motion.span>
              )}
              {!loading && previous && r && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-muted">
                  Δ vs previous run
                </motion.span>
              )}
            </AnimatePresence>
          }
        >
          <div aria-busy={loading}>
            <AnimatePresence>
              {error && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={springs.gentle}
                  className="overflow-hidden"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-contra/40 bg-contra/10 p-3 text-sm text-rose-100">
                    <span>{error}</span>
                    {input.symptoms.length > 0 && (
                      <button
                        onClick={() => void run(input)}
                        className="rounded-lg border border-contra/50 px-3 py-1 text-xs hover:bg-contra/20"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {whatIf && active.length === 0 && symptoms.length > 0 && (
              <p className="mb-3 text-xs text-warn">All symptoms are excluded. Include at least one to predict.</p>
            )}
            {loading && !r ? (
              <PredictionCardsSkeleton />
            ) : r ? (
              <div className={`transition-opacity ${loading ? "opacity-70" : ""}`}>
                <PredictionCards
                  result={r}
                  previous={previous?.result ?? null}
                  expanded={expanded}
                  onExpand={setExpanded}
                  highlight={highlight}
                  onHighlight={setHighlight}
                />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted">
                Add symptoms and press <span className="text-text">Analyze</span>, or turn on{" "}
                <span className="text-text">What-if</span> for live updates.
              </p>
            )}
          </div>
        </Panel>

        {r && (
          <div className="md:col-span-2 lg:col-span-12 empty:hidden">
            <RedFlags flags={r.red_flags} />
          </div>
        )}

        {r && (
          <>
            <Panel id="graph" title="Contribution graph" className="md:col-span-2 lg:col-span-7" aside={<GraphLegend />}>
              <ContributionGraph result={r} highlight={highlight} onHighlight={setHighlight} />
            </Panel>
            <Panel id="reasoning" title="Reasoning" accent="violet" className="md:col-span-2 lg:col-span-5">
              <ReasoningTimeline key={r.reasoning_steps.join("|")} steps={r.reasoning_steps} />
            </Panel>
            <Panel id="followups" title="Refine with follow-ups" className="md:col-span-2 lg:col-span-12">
              <FollowUpCards
                questions={r.follow_up_questions}
                answers={answers}
                disabled={loading}
                onAnswer={answer}
                onUndo={undo}
              />
            </Panel>
          </>
        )}
      </motion.main>

      <Disclaimer />
    </div>
  );
}

function WhatIfSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 text-xs text-muted hover:text-text"
    >
      <span className={on ? "text-neon-cyan" : ""}>What-if</span>
      <span
        className={`relative flex h-5 w-9 items-center rounded-full border p-0.5 transition-colors ${
          on ? "justify-end border-neon-cyan/60 bg-neon-cyan/25" : "justify-start border-line bg-white/5"
        }`}
      >
        <motion.span
          layout
          transition={springs.snappy}
          className={`size-3.5 rounded-full ${on ? "bg-neon-cyan shadow-[0_0_10px_#5eead4]" : "bg-muted"}`}
        />
      </span>
    </button>
  );
}
