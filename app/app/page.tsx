"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AboutStrip, WhatIfSwitch } from "@/components/app/AboutStrip";
import { Connectors } from "@/components/app/Connectors";
import { MobileBodyHeader } from "@/components/app/MobileBodyHeader";
import {
  RedFlagStrip,
  SecondaryPredictions,
  TopPrediction,
  TopPredictionEmpty,
  TopPredictionError,
  TopPredictionSkeleton,
} from "@/components/app/Predictions";
import { BodyStage, useBodyEnvironment } from "@/components/body-map/BodyMap";
import { RegionButtons } from "@/components/body-map/RegionButtons";
import { ReportButton } from "@/components/app/ReportButton";
import { ContributionGraph, GraphLegend, type ExtraSymptom } from "@/components/ContributionGraph";
import { Disclaimer } from "@/components/Disclaimer";
import { FollowUpCards, type AnswerFeedback, type AnswerValue } from "@/components/FollowUpCards";
import { ReasoningTimeline } from "@/components/ReasoningTimeline";
import { SymptomChips } from "@/components/SymptomChips";
import { SymptomSearch } from "@/components/SymptomSearch";
import { PanelTitle } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";
import { compare, highlightedSymptoms, noEffectSymptoms, pct, referencesIn, sortByConfidence, type Highlight } from "@/lib/explain";
import type { Duration, FollowUpAnswer, PredictInput, Sex } from "@/lib/predict/types";
import { findSymptom, REGIONS, symptomsInRegion, type Region } from "@/lib/symptoms";
import { inputKey, usePrediction } from "@/lib/usePrediction";
import { saveAnalysis, type SavedInput } from "@/lib/history";
import { PatientPicker } from "@/components/app/PatientPicker";
import { ageFrom, usePatients, type Patient } from "@/lib/patients";
import { authEnabled } from "@/lib/supabase/config";
import { useSession } from "@/lib/useSession";
import { glowForSymptoms } from "@/components/body-map/parts";
import { detailsToAnswers, type SymptomDetail } from "@/lib/symptomDetail";

const WHAT_IF_DEBOUNCE_MS = 600;

export default function PredictorApp() {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [age, setAge] = useState(30);
  const [sex, setSex] = useState<Sex>("female");
  const [duration, setDuration] = useState<Duration>("1-3d");
  const [answers, setAnswers] = useState<FollowUpAnswer[]>([]);
  // Optional per-symptom details (severity, onset, pattern, side, note), sent as extra answers.
  const [details, setDetails] = useState<Record<string, SymptomDetail>>({});
  const [whatIf, setWhatIf] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [hoverRegion, setHoverRegion] = useState<Region | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState<AnswerValue | null>(null);
  const [mobileStage, setMobileStage] = useState(false);
  const { response, previous, baseline, loading, error, run } = usePrediction();
  const { small } = useBodyEnvironment();
  const revealResults = useRef(false);
  // Manual runs (Analyze, follow-up answers) are saved to history for signed-in users once they return.
  const pendingSave = useRef<(Omit<SavedInput, "noEffect"> & { patientId: string | null }) | null>(null);
  // Optional patient this analysis is for (signed-in users; saved with the analysis, named on the PDF).
  const { user } = useSession();
  const [patient, setPatient] = useState<Patient | null>(null);
  const choosePatient = (p: Patient | null) => {
    setPatient(p);
    const a = ageFrom(p?.birth_year ?? null);
    if (a !== null) setAge(a);
    if (p?.sex) setSex(p.sex);
  };
  // "New analysis" from a patient's page opens /app?patient=<id> with that patient chosen.
  const { patients, setPatients } = usePatients(!!user, (rows) => {
    const id = new URLSearchParams(window.location.search).get("patient");
    const p = id ? rows.find((r) => r.id === id) : undefined;
    if (p) choosePatient(p);
  });
  const [savedFor, setSavedFor] = useState<object | null>(null);

  useEffect(() => {
    const pending = pendingSave.current;
    if (!response || !pending) return;
    pendingSave.current = null;
    const { patientId, ...p } = pending;
    const used = new Set(response.result.predictions.flatMap((x) => x.contributions.map((c) => c.symptom.toLowerCase())));
    const noEffect = p.symptoms.filter((x) => !p.excluded.includes(x) && !used.has(x.toLowerCase()));
    saveAnalysis(response.source, { ...p, noEffect }, response.result, patientId)
      .then((ok) => ok && setSavedFor(response))
      .catch((e) => console.error("[history] save failed", e));
  }, [response]);

  // After a manual Analyze on stacked layouts, bring the results into view once.
  useEffect(() => {
    if (!response || !revealResults.current) return;
    revealResults.current = false;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("results")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
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
  const active = useMemo(() => (whatIf ? symptoms.filter((s) => !excluded.has(s)) : symptoms), [symptoms, excluded, whatIf]);
  const detailAnswers = useMemo(() => detailsToAnswers(active, details), [active, details]);
  const input: PredictInput = useMemo(
    () => ({ symptoms: active, age, sex, duration, answers: [...detailAnswers, ...answers] }),
    [active, age, sex, duration, detailAnswers, answers],
  );
  const key = inputKey(input);
  const allIncluded = !whatIf || excluded.size === 0;

  // What-if: any change re-runs the prediction, debounced. Runs with every symptom included become the new "before".
  useEffect(() => {
    if (!whatIf || input.symptoms.length === 0) return;
    const t = setTimeout(() => void run(input, { skipIfUnchanged: true, asBaseline: allIncluded }), WHAT_IF_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // `key` captures every field of `input`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatIf, key, run]);

  // Editing a symptom's details after an analysis refreshes the result (debounced), so the detail visibly counts.
  const detailKey = JSON.stringify(detailAnswers);
  const lastDetailKey = useRef(detailKey);
  useEffect(() => {
    if (detailKey === lastDetailKey.current) return;
    lastDetailKey.current = detailKey;
    if (!response || whatIf || input.symptoms.length === 0) return;
    const t = setTimeout(() => void run(input, { skipIfUnchanged: true, asBaseline: allIncluded }), WHAT_IF_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // Only detail edits should trigger this; `input` already includes them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailKey]);

  // On phones the picker lives in the collapsible body stage: opening a region also opens the stage.
  const selectRegion = (reg: Region | null) => {
    setActiveRegion(reg);
    if (reg && small && !mobileStage) {
      setMobileStage(true);
      requestAnimationFrame(() => document.getElementById("mobile-stage")?.scrollIntoView({ block: "center" }));
    }
  };

  const toggleSymptom = (label: string) => {
    setSymptoms((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
    setDetails((d) => {
      if (!(label in d)) return d;
      const rest = { ...d };
      delete rest[label];
      return rest;
    });
    setExcluded((e) => {
      if (!e.has(label)) return e;
      const n = new Set(e);
      n.delete(label);
      return n;
    });
  };
  const addSymptom = (label: string) => setSymptoms((s) => (s.some((x) => x.toLowerCase() === label.toLowerCase()) ? s : [...s, label]));
  const severeCount = symptoms.filter((s) => details[s]?.severity === "severe").length;
  const toggleExcluded = (label: string) => {
    setPendingAnswer(null);
    setExcluded((e) => {
      const n = new Set(e);
      if (n.has(label)) n.delete(label);
      else n.add(label);
      return n;
    });
  };
  const setWhatIfMode = (on: boolean) => {
    setWhatIf(on);
    if (!on) setExcluded(new Set());
  };
  const queueSave = (next: FollowUpAnswer[]) => {
    pendingSave.current = { symptoms, age, sex, duration, answers: [...detailAnswers, ...next], excluded: whatIf ? [...excluded] : [], patientId: patient?.id ?? null };
  };
  const analyze = () => {
    revealResults.current = true;
    queueSave([]);
    setAnswers([]);
    setPendingAnswer(null);
    setStep(null);
    void run({ ...input, answers: detailAnswers }, { asBaseline: allIncluded });
  };
  const updateAnswers = (next: FollowUpAnswer[], value: AnswerValue | null) => {
    setAnswers(next);
    setPendingAnswer(value);
    queueSave(next);
    // In what-if mode the debounced effect picks this up; otherwise run now.
    if (!whatIf) void run({ ...input, answers: [...detailAnswers, ...next] }, { asBaseline: true });
  };
  const answer = (question: string, value: AnswerValue) =>
    updateAnswers([...answers.filter((a) => a.question !== question), { question, answer: value }], value);
  const undo = (question: string) => updateAnswers(answers.filter((a) => a.question !== question), null);

  // ---------- derived result views ----------
  const r = response?.result;
  const ranked = r ? sortByConfidence(r) : [];
  const top = ranked[0] ?? null;
  const cmp = r ? compare(r, previous?.result) : null;
  const deltas = new Map<string, number | null>([...(cmp?.deltas ?? new Map())].map(([k, v]) => [k, v.delta]));
  const showWhatIf = whatIf && excluded.size > 0 && !!baseline;
  const before = showWhatIf ? new Map(baseline!.result.predictions.map((p) => [p.condition, p.confidence])) : null;
  const sentNoEffect = r ? noEffectSymptoms(r, active) : [];
  const extras: ExtraSymptom[] = [
    ...sentNoEffect.map((label) => ({ label, tag: "no effect" as const })),
    ...(whatIf ? [...excluded].filter((s) => symptoms.includes(s)).map((label) => ({ label, tag: "excluded" as const })) : []),
  ];
  const feedback: AnswerFeedback | null =
    pendingAnswer && !loading && top && previous ? { answer: pendingAnswer, condition: top.condition, delta: pct(top.confidence) - pct(previous.result.predictions.find((p) => p.condition === top.condition)?.confidence ?? top.confidence), after: pct(top.confidence) } : null;

  // Reasoning step selection → highlight what it mentions.
  const selectStep = (i: number | null) => {
    setStep(i);
    if (i === null || !r) return setHighlight(null);
    const refs = referencesIn(r.reasoning_steps[i], symptoms, r.predictions.map((p) => p.condition));
    setHighlight({ kind: "refs", ...refs });
  };
  const setHover = (h: Highlight) => {
    if (step !== null && h === null && r) return selectStep(step); // keep the step's highlight when hover ends
    setHighlight(h);
  };

  // Body ↔ symptoms: hovering a region lights its chips; hovering a symptom lights its region.
  const litSymptoms = highlightedSymptoms(highlight);
  const regionFromHighlight = litSymptoms.length === 1 ? (findSymptom(litSymptoms[0])?.region ?? null) : null;
  const onHoverRegion = (reg: Region | null) => {
    setHoverRegion(reg);
    if (step !== null) return;
    setHighlight(reg ? { kind: "refs", symptoms: symptoms.filter((s) => findSymptom(s)?.region === reg), conditions: [] } : null);
  };

  // Organs and areas affected by the active symptoms; the hovered / referenced ones at full strength.
  const glow = useMemo(() => glowForSymptoms(active, details, litSymptoms), [active, details, litSymptoms]);

  const flagNote = r?.red_flags.length ? ` ${r.red_flags.length} red flag${r.red_flags.length === 1 ? "" : "s"}.` : "";
  const announcement = top ? `Results updated. Top match: ${top.condition}, ${pct(top.confidence)} percent.${flagNote}` : "";

  const firstExcluded = [...excluded][0];
  const stage = (
    <BodyStage
      counts={counts}
      activeRegion={activeRegion}
      onSelectRegion={selectRegion}
      highlightRegion={hoverRegion ?? regionFromHighlight}
      onHoverRegion={onHoverRegion}
      scanning={loading}
      glow={glow}
      selected={symptoms}
      onToggleSymptom={toggleSymptom}
      overlay={top && !loading && !small ? <Connectors counts={counts} lit={regionFromHighlight} /> : undefined}
      className="h-full min-h-[380px]"
    />
  );

  return (
    <div className="relative z-10 flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <a href="#results" className="sr-only bg-raised px-4 py-2 text-sm text-cyan focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">
        Skip to results
      </a>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <Nav
        compact
        right={
          response && (
            <span className="rounded-full bg-amber/12 px-2.5 py-1 text-xs font-medium text-amber">
              {response.source === "mock" ? "Demo mode" : "Live model"}
            </span>
          )
        }
      />
      <h1 className="sr-only">ClearDx symptom predictor</h1>

      {small && (
        <MobileBodyHeader counts={counts} top={top} loading={loading} error={!!error} expanded={mobileStage} onToggle={() => setMobileStage((v) => !v)} />
      )}

      <div className="px-3 pt-3 lg:px-6">
        <AboutStrip
          age={age}
          sex={sex}
          duration={duration}
          onAge={setAge}
          onSex={setSex}
          onDuration={setDuration}
          lead={
            authEnabled && (
              <PatientPicker
                signedIn={!!user}
                patients={patients}
                value={patient}
                onChange={choosePatient}
                onCreated={(p) => setPatients((all) => [...(all ?? []), p].sort((a, b) => a.name.localeCompare(b.name)))}
              />
            )
          }
        >
          {symptoms.length > 0 && <WhatIfSwitch on={whatIf} onChange={setWhatIfMode} />}
          <button type="button" onClick={analyze} disabled={symptoms.length === 0 || active.length === 0 || loading} className="btn btn-primary">
            {loading ? (
              <>
                <svg className="size-3.5 animate-spin" viewBox="0 0 14 14" aria-hidden>
                  <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 20" />
                </svg>
                Analyzing
              </>
            ) : response ? (
              "Re-analyze"
            ) : (
              "Analyze"
            )}
          </button>
        </AboutStrip>
      </div>

      <main className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 lg:grid lg:grid-cols-[280px_300px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_276px] xl:grid-cols-[320px_360px_minmax(0,1fr)] lg:px-6">
        {/* ---------- Symptoms ---------- */}
        <section aria-labelledby="sym-title" className="hud flex min-h-0 flex-col gap-3 p-4 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center justify-between">
            <PanelTitle id="sym-title">
              Symptoms
              {symptoms.length > 0 && <span className="font-mono text-[13px] font-medium text-muted">{symptoms.length}</span>}
              {severeCount > 0 && <span className="rounded-full bg-contra/12 px-2 py-0.5 text-[11px] font-semibold text-contra">{severeCount} severe</span>}
            </PanelTitle>
            {symptoms.length > 0 && (
              <button type="button" onClick={() => (setSymptoms([]), setExcluded(new Set()))} className="h-7 rounded-full px-3 text-[13px] font-medium text-muted transition-colors hover:bg-fill hover:text-contra">
                Clear all
              </button>
            )}
          </div>
          <SymptomSearch selected={symptoms} onAdd={addSymptom} />
          <RegionButtons counts={counts} active={activeRegion} highlighted={hoverRegion ?? regionFromHighlight} onSelect={(reg) => selectRegion(activeRegion === reg ? null : reg)} onHover={onHoverRegion} />
          <div className="min-h-0 flex-1 overflow-auto">
            <SymptomChips
              symptoms={symptoms}
              onReorder={setSymptoms}
              onRemove={toggleSymptom}
              whatIf={whatIf}
              disabled={excluded}
              onToggleEnabled={toggleExcluded}
              highlighted={litSymptoms}
              noEffect={new Set(sentNoEffect)}
              onHover={(s) => step === null && setHighlight(s ? { kind: "symptom", id: s } : null)}
              details={details}
              onDetail={(label, d) => setDetails((all) => ({ ...all, [label]: d }))}
              onAdd={addSymptom}
            />
          </div>
          <p className="text-[13px] text-soft">
            {whatIf
              ? excluded.size
                ? `What-if: ${excluded.size} left out. Tap a symptom to include it again.`
                : "What-if: tap a symptom to leave it out."
              : symptoms.length > 1
                ? "Drag to rank by how much each bothers you."
                : activeRegion
                  ? `Showing ${symptomsInRegion(activeRegion).length} options on the body.`
                  : ""}
          </p>
        </section>

        {/* ---------- Body stage ---------- */}
        {!small && <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">{stage}</div>}
        {small && mobileStage && (
          <div id="mobile-stage" className="h-[440px]">
            {stage}
          </div>
        )}

        {/* ---------- Results ---------- */}
        <div id="results" tabIndex={-1} className="flex min-h-0 scroll-mt-28 flex-col gap-3 outline-none lg:col-start-3 lg:row-start-1 lg:overflow-y-auto lg:rounded-[22px]" aria-busy={loading}>
          {r && <RedFlagStrip flags={r.red_flags} />}
          {error ? (
            <TopPredictionError message={error} onRetry={input.symptoms.length ? () => void run(input, { asBaseline: allIncluded }) : undefined} />
          ) : loading && !top ? (
            <TopPredictionSkeleton count={active.length} />
          ) : top ? (
            <TopPrediction
              prediction={top}
              before={before?.get(top.condition) ?? null}
              excludedLabel={excluded.size === 1 ? firstExcluded : excluded.size > 1 ? `${excluded.size} symptoms` : undefined}
              delta={deltas.get(top.condition)}
              noEffect={sentNoEffect}
              highlight={highlight}
              onHighlight={setHover}
              updating={loading}
              actions={
                response && (
                  <>
                  {savedFor === response && <span className="label !text-support">✓ Saved</span>}
                  <ReportButton
                    disabled={loading}
                    response={response}
                    symptoms={symptoms}
                    excluded={whatIf ? [...excluded] : []}
                    noEffect={sentNoEffect}
                    age={age}
                    sex={sex}
                    duration={duration}
                    answers={answers}
                    patientName={patient?.name}
                  />
                  </>
                )
              }
            />
          ) : (
            <TopPredictionEmpty />
          )}
          {loading && !top ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <li key={i} className="skeleton h-[78px]" />
              ))}
            </ul>
          ) : (
            ranked.length > 1 && !error && <SecondaryPredictions predictions={ranked.slice(1, 4)} before={before} deltas={deltas} highlight={highlight} onHighlight={setHover} />
          )}
        </div>

        {/* ---------- Follow-ups ---------- */}
        <section aria-labelledby="fu-title" className="hud flex min-h-0 flex-col gap-3 p-4 lg:col-start-1 lg:row-start-2">
          <PanelTitle id="fu-title">Refine</PanelTitle>
          {r && !error ? (
            <FollowUpCards questions={r.follow_up_questions} answers={answers} disabled={loading} onAnswer={answer} onUndo={undo} feedback={feedback} />
          ) : loading ? (
            <div className="space-y-2" aria-hidden>
              <div className="skeleton h-4" />
              <div className="skeleton h-4 w-2/3" />
              <div className="grid grid-cols-3 gap-2 pt-6">
                <div className="skeleton h-10" />
                <div className="skeleton h-10" />
                <div className="skeleton h-10" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-soft">Questions that sharpen the result appear here after an analysis.</p>
          )}
        </section>

        {/* ---------- Why: graph + reasoning ---------- */}
        <div className="flex min-h-0 flex-col gap-3 lg:col-start-3 lg:row-start-2 xl:grid xl:grid-cols-[minmax(0,1fr)_230px]">
          <section aria-labelledby="graph-title" className="hud flex min-h-0 flex-col gap-3 overflow-y-auto p-4 lg:flex-1 xl:flex-none">
            <div className="flex items-center justify-between gap-3">
              <PanelTitle id="graph-title">Why</PanelTitle>
              <GraphLegend />
            </div>
            {r && !error ? (
              <ContributionGraph result={r} highlight={highlight} onHighlight={setHover} extras={extras} minHeight={200} />
            ) : loading ? (
              <div className="flex-1 space-y-3 pt-3" aria-hidden>
                <div className="skeleton h-3" />
                <div className="skeleton h-3 w-5/6" />
                <div className="skeleton h-3 w-4/6" />
              </div>
            ) : (
              <div className="grid min-h-[160px] flex-1 place-items-center rounded-2xl bg-fill px-6 text-center text-sm text-soft">
                Lines from each symptom to each condition appear here.
              </div>
            )}
          </section>
          <section aria-labelledby="rs-title" className="hud flex min-h-0 flex-col gap-3 p-4 lg:flex-1 xl:flex-none">
            <PanelTitle id="rs-title">
              Reasoning
            </PanelTitle>
            {r && !error ? (
              <ReasoningTimeline key={r.reasoning_steps.join("|")} steps={r.reasoning_steps} selected={step} onSelect={selectStep} />
            ) : loading ? (
              <div className="space-y-2" aria-hidden>
                <div className="skeleton h-3" />
                <div className="skeleton h-3 w-4/5" />
              </div>
            ) : (
              <p className="text-sm text-soft">Each step appears one at a time. Click a step to see what it refers to.</p>
            )}
          </section>
        </div>
      </main>

      <Disclaimer className="mx-3 mb-3 lg:mx-6" />
    </div>
  );
}
