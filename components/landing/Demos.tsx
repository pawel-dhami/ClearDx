"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ConfidenceRing, DeltaTag, SeverityTag } from "@/components/app/Predictions";
import { ContributionGraph, GraphLegend } from "@/components/ContributionGraph";
import { noEffectSymptoms, type Highlight } from "@/lib/explain";
import { mockPredict } from "@/lib/predict/mock";
import type { PredictInput } from "@/lib/predict/types";

/** Loops a value between 0 and `to` every `period` ms (static at `to` with reduced motion). */
function useLoop(to: number, period = 3600) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(to);
  useEffect(() => {
    if (reduced) return;
    let on = true;
    const id = setInterval(() => {
      on = !on;
      setV(on ? to : 0);
    }, period / 2);
    return () => clearInterval(id);
  }, [to, period, reduced]);
  return reduced ? to : v;
}

// ---------- How it works: looping mini-scenes ----------

export function StepPickScene() {
  const reduced = useReducedMotion();
  const [n, setN] = useState(3);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setN((x) => (x + 1) % 4), 900);
    return () => clearInterval(id);
  }, [reduced]);
  const shown = reduced ? 3 : n;
  return (
    <div className="flex h-32 items-center gap-5 border border-cyan/12 bg-cyan/[0.03] px-5" aria-hidden>
      <svg width="44" height="96" viewBox="0 0 44 96">
        <circle cx="22" cy="10" r="8" fill="none" stroke="#00f0ff" strokeOpacity=".5" />
        <rect x="10" y="22" width="24" height="30" fill="rgb(0 240 255 / 0.25)" stroke="#00f0ff" />
        <rect x="12" y="54" width="20" height="40" fill="none" stroke="#00f0ff" strokeOpacity=".4" />
      </svg>
      <ul className="flex flex-col gap-1.5">
        {["Fever", "Cough", "Muscle aches"].map((s, i) => (
          <motion.li
            key={s}
            animate={{ opacity: i < shown ? 1 : 0, y: i < shown ? 0 : -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex min-h-8 items-center gap-2 rounded-[2px] border border-cyan bg-cyan/6 px-2.5 text-sm"
          >
            <span className="font-mono text-[11px] text-muted">0{i + 1}</span>
            {s}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function StepPredictScene() {
  const v = useLoop(0.81);
  return (
    <div className="flex h-32 items-center gap-5 border border-cyan/12 bg-cyan/[0.03] px-5" aria-hidden>
      <ConfidenceRing value={v} size={96} />
      <ul className="flex-1 space-y-1.5 text-sm">
        <li className="flex justify-between">
          <span className="font-display font-semibold tracking-[0.05em] uppercase">Influenza</span>
          <span className="font-mono text-cyan">81%</span>
        </li>
        <li className="flex justify-between text-soft">
          <span>COVID-19</span>
          <span className="font-mono">66%</span>
        </li>
        <li className="flex justify-between text-soft">
          <span>Common cold</span>
          <span className="font-mono">29%</span>
        </li>
      </ul>
    </div>
  );
}

export function StepWhyScene() {
  const reduced = useReducedMotion();
  const edges = [
    { d: "M64 30 C140 30 150 66 220 66", c: "#00ff66", w: 5 },
    { d: "M64 66 L220 66", c: "#00ff66", w: 5 },
    { d: "M70 102 C140 102 150 70 220 70", c: "#ff3b5c", w: 2.5, dash: "6 5" },
  ];
  return (
    <div className="h-32 border border-cyan/12 bg-cyan/[0.03]" aria-hidden>
      <svg viewBox="0 0 300 132" className="h-full w-full">
        <g fontSize="11" fill="#94a3b8" style={{ fontFamily: "var(--font-mono)" }}>
          <text x="12" y="34">FEVER</text>
          <text x="12" y="70">ACHES</text>
          <text x="12" y="106">SNEEZE</text>
          <text x="232" y="70" fill="#e2e8f0">INFLUENZA</text>
        </g>
        {edges.map((e, i) => (
          <motion.path
            key={i}
            d={e.d}
            stroke={e.c}
            strokeWidth={e.w}
            fill="none"
            strokeDasharray={e.dash}
            initial={{ pathLength: reduced ? 1 : 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 1, delay: i * 0.3, repeat: Infinity, repeatDelay: 2, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
        <circle cx="220" cy="66" r="6" fill="#00f0ff" />
      </svg>
    </div>
  );
}

// ---------- Explainability showcase: the real graph, driven by the real mock predictor ----------

const SHOWCASE_INPUT: PredictInput = {
  symptoms: ["Fever", "Chills", "Muscle aches", "Sneezing", "Leg swelling"],
  age: 30,
  sex: "female",
  duration: "1-3d",
};

export function ShowcaseGraph() {
  const result = useMemo(() => {
    const r = mockPredict(SHOWCASE_INPUT);
    return { ...r, predictions: r.predictions.slice(0, 3) };
  }, []);
  const extras = useMemo(() => noEffectSymptoms(result, SHOWCASE_INPUT.symptoms).map((label) => ({ label, tag: "no effect" as const })), [result]);
  const [highlight, setHighlight] = useState<Highlight>(null);
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="label">Hover or focus any line or node · Mock data</p>
        <GraphLegend />
      </div>
      <div className="min-h-0 flex-1">
        <ContributionGraph result={result} highlight={highlight} onHighlight={setHighlight} extras={extras} minHeight={340} />
      </div>
    </div>
  );
}

// ---------- Feature grid mini-demos ----------

export function WhatIfDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4" aria-label="Influenza 81 percent before, 69 percent after excluding Fever">
      <div className="text-center">
        <p className="label">Before</p>
        <p className="font-mono text-4xl font-bold">
          81<span className="text-lg text-muted">%</span>
        </p>
      </div>
      <span className="font-mono text-muted" aria-hidden>
        →
      </span>
      <div className="text-center">
        <p className="label">After</p>
        <p className="font-mono text-4xl font-bold text-cyan">
          69<span className="text-lg text-muted">%</span>
        </p>
      </div>
      <DeltaTag delta={-0.12} />
      <SeverityTag severity="moderate" />
    </div>
  );
}
