"use client";

import { AnimatePresence, LayoutGroup, motion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, type Ref } from "react";
import { compare, pct, type Highlight } from "@/lib/explain";
import { springs } from "@/lib/motion";
import type { Prediction, PredictionResult, Severity } from "@/lib/predict/types";

const SEVERITY: Record<Severity, { label: string; cls: string }> = {
  low: { label: "Low", cls: "text-support border-support/30 bg-support/10" },
  moderate: { label: "Moderate", cls: "text-warn border-warn/30 bg-warn/10" },
  high: { label: "High", cls: "text-orange-300 border-orange-300/30 bg-orange-300/10" },
  emergency: { label: "Emergency", cls: "text-contra border-contra/40 bg-contra/15" },
};

// ---------- pieces ----------

function AnimatedPercent({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 120, damping: 20 });
  const text = useTransform(spring, (v) => `${Math.round(v)}`);
  useEffect(() => {
    spring.set(value * 100);
  }, [spring, value]);
  return <motion.span>{text}</motion.span>;
}

export function ConfidenceRing({ value, size = 64 }: { value: number; size?: number }) {
  const id = useId();
  const stroke = 6;
  const r = (size - stroke) / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* brief glow whenever the value changes */}
      <motion.span
        key={value}
        aria-hidden
        className="absolute inset-0 rounded-full bg-neon-cyan/25 blur-md"
        initial={{ opacity: 0.7, scale: 0.85 }}
        animate={{ opacity: 0, scale: 1.25 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5eead4" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.001, value) }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          style={{ filter: "drop-shadow(0 0 6px rgba(94,234,212,.45))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-mono text-sm font-semibold tabular-nums">
        <span>
          <AnimatedPercent value={value} />
          <span className="text-[10px] text-muted">%</span>
        </span>
      </div>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta === undefined) return null;
  const isNew = delta === null;
  const d = isNew ? 0 : pct(delta);
  if (!isNew && d === 0) {
    return <span className="text-[11px] text-muted">±0</span>;
  }
  const up = isNew || d > 0;
  return (
    <motion.span
      key={isNew ? "new" : d}
      initial={{ scale: 0.4, opacity: 0, y: up ? 6 : -6 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={springs.snappy}
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
        isNew ? "bg-neon-blue/15 text-neon-blue" : up ? "bg-support/15 text-support" : "bg-contra/15 text-contra"
      }`}
      aria-label={isNew ? "New in results" : `${up ? "Up" : "Down"} ${Math.abs(d)} points`}
    >
      {isNew ? "NEW" : `${up ? "▲" : "▼"} ${Math.abs(d)}`}
    </motion.span>
  );
}

function ContributionBars({ prediction, highlight }: { prediction: Prediction; highlight: Highlight }) {
  return (
    <ul className="space-y-2.5">
      {prediction.contributions.map((c) => {
        const support = c.weight >= 0;
        const w = Math.abs(c.weight) * 50; // half the bar width = weight 1
        const hl = highlight?.kind === "symptom" && highlight.id === c.symptom;
        return (
          <li key={c.symptom} className={`rounded-xl p-1.5 transition-colors ${hl ? "bg-white/5" : ""}`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-text">{c.symptom}</span>
              <span className={`font-mono ${support ? "text-support" : "text-contra"}`}>
                {support ? "+" : "−"}
                {Math.abs(c.weight).toFixed(2)}
              </span>
            </div>
            {/* diverging bar centred on zero */}
            <div className="relative mt-1 h-1.5 rounded-full bg-white/5">
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
              <motion.div
                className={`absolute inset-y-0 rounded-full ${support ? "left-1/2 bg-support" : "right-1/2 bg-contra"}`}
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={springs.gentle}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{c.reason}</p>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- card ----------

interface CardProps {
  prediction: Prediction;
  rank: number;
  delta: number | null | undefined;
  expanded: boolean;
  highlight: Highlight;
  onToggle: () => void;
  onHighlight: (h: Highlight) => void;
  /** AnimatePresence popLayout needs a ref on each direct child to measure exiting cards. */
  ref?: Ref<HTMLLIElement>;
}

function Card({ prediction: p, rank, delta, expanded, highlight, onToggle, onHighlight, ref }: CardProps) {
  const sev = SEVERITY[p.severity];
  const lit =
    (highlight?.kind === "condition" && highlight.id === p.condition) ||
    (highlight?.kind === "symptom" && p.contributions.some((c) => c.symptom === highlight.id));
  const dim = highlight && !lit;
  const top = [...p.contributions].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const panelId = useId();

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: dim ? 0.45 : 1, scale: 1, y: 0 }}
      whileHover={{ y: -2 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={springs.layout}
      onPointerEnter={() => onHighlight({ kind: "condition", id: p.condition })}
      onPointerLeave={() => onHighlight(null)}
      className={`overflow-hidden rounded-2xl border transition-colors ${
        lit ? "border-neon-cyan/50 bg-neon-cyan/[0.05]" : "border-line bg-white/[0.025]"
      } ${p.severity === "emergency" ? "shadow-[inset_3px_0_0_#fb7185]" : ""}`}
    >
      <motion.button
        layout="position"
        onClick={onToggle}
        onFocus={() => onHighlight({ kind: "condition", id: p.condition })}
        onBlur={() => onHighlight(null)}
        aria-expanded={expanded}
        aria-controls={panelId}
        whileTap={{ scale: 0.99 }}
        className="flex w-full items-center gap-4 p-3 text-left"
      >
        <ConfidenceRing value={p.confidence} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-muted">#{rank}</span>
            <span className="font-medium">{p.condition}</span>
            <DeltaBadge delta={delta} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${sev.cls}`}>
              {sev.label}
            </span>
            {!expanded &&
              top.map((c) => (
                <span
                  key={c.symptom}
                  className={`rounded-full px-1.5 py-0.5 text-[11px] ${
                    c.weight >= 0 ? "bg-support/10 text-support" : "bg-contra/10 text-contra"
                  }`}
                >
                  {c.weight >= 0 ? "+" : "−"} {c.symptom}
                </span>
              ))}
          </div>
        </div>
        <motion.span
          aria-hidden
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={springs.snappy}
          className="text-muted"
        >
          ⌄
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.gentle}
          >
            <div className="border-t border-line px-3 pt-3 pb-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-muted">Why this prediction</p>
              <ContributionBars prediction={p} highlight={highlight} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

// ---------- list ----------

interface PredictionCardsProps {
  result: PredictionResult;
  previous: PredictionResult | null;
  expanded: string | null;
  onExpand: (condition: string | null) => void;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
}

export function PredictionCards({ result, previous, expanded, onExpand, highlight, onHighlight }: PredictionCardsProps) {
  const cmp = compare(result, previous);
  const sorted = [...result.predictions].sort((a, b) => b.confidence - a.confidence);

  return (
    <LayoutGroup>
      <motion.ul layout className="space-y-2.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {sorted.map((p, i) => (
            <Card
              key={p.condition}
              prediction={p}
              rank={i + 1}
              delta={cmp?.deltas.get(p.condition)?.delta}
              expanded={expanded === p.condition}
              highlight={highlight}
              onToggle={() => onExpand(expanded === p.condition ? null : p.condition)}
              onHighlight={onHighlight}
            />
          ))}
        </AnimatePresence>
      </motion.ul>
      <AnimatePresence>
        {cmp && cmp.dropped.length > 0 && (
          <motion.p
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={springs.gentle}
            className="mt-3 text-xs text-muted"
          >
            Dropped out:{" "}
            {cmp.dropped.map((d, i) => (
              <span key={d.condition}>
                {i > 0 && ", "}
                <span className="text-text/80 line-through decoration-contra/60">{d.condition}</span>{" "}
                <span className="font-mono">(was {pct(d.confidence)}%)</span>
              </span>
            ))}
          </motion.p>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}

export function PredictionCardsSkeleton() {
  return (
    <ul className="space-y-2.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-4 rounded-2xl border border-line p-3">
          <div className="skeleton size-16 rounded-full!" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </li>
      ))}
    </ul>
  );
}
