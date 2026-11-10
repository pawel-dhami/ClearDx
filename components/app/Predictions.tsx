"use client";

import { AnimatePresence, motion, useSpring, useTransform } from "motion/react";
import { useEffect, useId, type Ref } from "react";
import { Corners, PanelTitle } from "@/components/site/Hud";
import { highlightedConditions, pct, type Highlight } from "@/lib/explain";
import { springs } from "@/lib/motion";
import type { Prediction, Severity } from "@/lib/predict/types";

export const SEVERITY: Record<Severity, { label: string; short: string; cls: string }> = {
  low: { label: "Low", short: "LOW", cls: "text-support border-support/45" },
  moderate: { label: "Moderate", short: "MOD", cls: "text-amber border-amber/50" },
  high: { label: "High", short: "HIGH", cls: "text-severe border-severe/50" },
  emergency: { label: "Emergency", short: "EMERG", cls: "text-contra border-contra/60" },
};

export function SeverityTag({ severity, short = false }: { severity: Severity; short?: boolean }) {
  const s = SEVERITY[severity];
  return (
    <span className={`rounded-[2px] border px-1.5 py-0.5 font-mono text-[11px] tracking-[0.08em] ${s.cls}`} aria-label={`Severity: ${s.label}`}>
      {short ? s.short : s.label.toUpperCase()}
    </span>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(value, { stiffness: 120, damping: 20 });
  const text = useTransform(spring, (v) => `${Math.round(v)}`);
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span>{text}</motion.span>;
}

export function ConfidenceRing({ value, before, size = 150 }: { value: number; before?: number | null; size?: number }) {
  const id = useId();
  const stroke = 8;
  const r = (size - stroke) / 2 - 2;
  const C = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* brief glow whenever the value changes */}
      <motion.span key={value} aria-hidden className="absolute inset-0 rounded-full bg-cyan/20 blur-lg" initial={{ opacity: 0.8, scale: 0.85 }} animate={{ opacity: 0, scale: 1.2 }} transition={{ duration: 0.9, ease: "easeOut" }} />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab, var(--accent) 8%, transparent)" strokeWidth={stroke} />
        {before != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(148 163 184 / 0.35)" strokeWidth={stroke} strokeDasharray={C} strokeDashoffset={C * (1 - before)} />
        )}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - Math.max(0.001, value)) }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          filter={`url(#${id})`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-mono font-bold leading-none tabular-nums" style={{ fontSize: size * 0.27 }}>
            <AnimatedNumber value={pct(value)} />
            <span className="text-[0.45em] text-muted">%</span>
          </p>
          {size >= 120 && <p className="label mt-1">Confidence</p>}
        </div>
      </div>
    </div>
  );
}

export function DeltaTag({ delta, className = "" }: { delta: number | null | undefined; className?: string }) {
  if (delta === undefined) return null;
  if (delta === null) return <span className={`rounded-[2px] border border-cyan/50 px-1.5 font-mono text-xs text-cyan ${className}`}>NEW</span>;
  const d = pct(delta);
  if (d === 0) return <span className={`font-mono text-xs text-muted ${className}`}>±0</span>;
  const up = d > 0;
  return (
    <motion.span
      key={d}
      initial={{ scale: 0.5, opacity: 0, y: up ? 6 : -6 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={springs.snappy}
      className={`rounded-[2px] border px-1.5 font-mono text-xs ${up ? "border-support/60 text-support" : "border-contra/70 text-contra"} ${className}`}
      aria-label={`${up ? "Up" : "Down"} ${Math.abs(d)} points`}
    >
      {up ? "▲ +" : "▼ −"}
      {Math.abs(d)}
    </motion.span>
  );
}

// ---------- Top prediction (hero) ----------

interface TopPredictionProps {
  prediction: Prediction;
  /** Confidence before the what-if exclusions (baseline), shown side by side. */
  before?: number | null;
  excludedLabel?: string;
  /** Change vs the previous run (answers, edits). */
  delta?: number | null;
  noEffect: string[];
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
  updating?: boolean;
  /** Header actions, e.g. the report download. */
  actions?: React.ReactNode;
}

export function TopPrediction({ prediction: p, before, excludedLabel, delta, noEffect, highlight, onHighlight, updating, actions }: TopPredictionProps) {
  const supports = p.contributions.filter((c) => c.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 3);
  const against = p.contributions.filter((c) => c.weight < 0).sort((a, b) => a.weight - b.weight).slice(0, 2);
  const lit = highlightedConditions(highlight).includes(p.condition);
  const showWhatIf = before != null && Math.round(before * 100) !== pct(p.confidence);
  return (
    <section
      aria-labelledby="top-title"
      onPointerEnter={() => onHighlight({ kind: "condition", id: p.condition })}
      onPointerLeave={() => onHighlight(null)}
      className={`hud flex min-h-0 flex-1 flex-col p-5 transition-colors ${lit ? "border-cyan" : ""}`}
    >
      <Corners />
      <div className="flex items-center justify-between gap-3">
        <PanelTitle id="top-title">Top match</PanelTitle>
        <div className="flex items-center gap-3">
          <span className="label">{updating ? <span className="text-cyan">Updating…</span> : delta !== undefined ? "Δ vs previous run" : ""}</span>
          {actions}
        </div>
      </div>
      <div className={`mt-3 flex flex-col items-start gap-5 transition-opacity sm:flex-row sm:items-center sm:gap-6 ${updating ? "opacity-70" : ""}`}>
        <ConfidenceRing value={p.confidence} before={showWhatIf ? before : null} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-4xl leading-none font-bold tracking-[0.05em] uppercase sm:text-[44px]">{p.condition}</h3>
            <SeverityTag severity={p.severity} />
            {!showWhatIf && <DeltaTag delta={delta} />}
          </div>
          {showWhatIf && (
            <div className="mt-3 flex flex-wrap items-center gap-3" aria-label={`What-if: ${pct(before!)} percent before, ${pct(p.confidence)} percent after`}>
              <span className="label">What-if</span>
              <span className="font-mono text-lg text-muted">{pct(before!)}%</span>
              <span className="font-mono text-muted" aria-hidden>→</span>
              <span className="font-mono text-lg font-bold text-cyan">{pct(p.confidence)}%</span>
              <DeltaTag delta={p.confidence - before!} />
              {excludedLabel && <span className="text-sm text-soft">without {excludedLabel}</span>}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="label mb-2 !text-support">+ Supports</p>
              <ul className="space-y-1.5 text-sm">
                {supports.map((c) => (
                  <li key={c.symptom} className="flex justify-between gap-2" title={c.reason}>
                    <span>{c.symptom}</span>
                    <span className="font-mono text-support">+{c.weight.toFixed(2)}</span>
                  </li>
                ))}
                {supports.length === 0 && <li className="text-soft">None</li>}
              </ul>
            </div>
            <div>
              <p className="label mb-2 !text-contra">− Contradicts</p>
              <ul className="space-y-1.5 text-sm">
                {against.map((c) => (
                  <li key={c.symptom} className="flex justify-between gap-2" title={c.reason}>
                    <span>{c.symptom}</span>
                    <span className="font-mono text-contra">−{Math.abs(c.weight).toFixed(2)}</span>
                  </li>
                ))}
                {noEffect.slice(0, 2).map((s) => (
                  <li key={s} className="flex justify-between gap-2 text-soft">
                    <span>{s}</span>
                    <span className="font-mono">no effect</span>
                  </li>
                ))}
                {against.length === 0 && noEffect.length === 0 && <li className="text-soft">None</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TopPredictionSkeleton({ count }: { count: number }) {
  return (
    <section className="hud flex flex-1 items-center gap-6 p-5" aria-busy="true" aria-label="Analyzing">
      <Corners only={["tl", "br"]} />
      <svg width="150" height="150" viewBox="0 0 160 160" className="shrink-0" aria-hidden>
        <circle cx="80" cy="80" r="70" fill="none" stroke="color-mix(in oklab, var(--accent) 8%, transparent)" strokeWidth="8" />
        <circle cx="80" cy="80" r="70" fill="none" stroke="var(--accent)" strokeWidth="8" strokeDasharray="90 350" className="origin-center animate-spin [animation-duration:1.6s]" />
      </svg>
      <div className="flex-1 space-y-3">
        <p className="label !text-cyan">Analyzing {count} symptom{count === 1 ? "" : "s"}…</p>
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-4 w-1/2" />
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
        </div>
      </div>
    </section>
  );
}

export function TopPredictionEmpty() {
  return (
    <section className="hud-quiet flex flex-1 flex-col justify-center p-6" aria-label="No result yet">
      <p className="label">Top match</p>
      <h2 className="mt-2 font-display text-4xl leading-none font-bold tracking-[0.05em] uppercase">Awaiting input</h2>
      <ol className="mt-5 grid gap-4 text-sm text-soft sm:grid-cols-3">
        {["Point at a region of the body", "Pick what you feel, then set age and duration", "Press Analyze to see ranked conditions and why"].map((t, i) => (
          <li key={t} className="border-t border-cyan/30 pt-3">
            <span className="font-mono text-cyan">0{i + 1}</span>
            <br />
            {t}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function TopPredictionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section role="alert" className="hud flex flex-1 flex-col justify-center !border-contra/50 p-6">
      <Corners tone="contra" />
      <p className="font-mono text-xs font-bold tracking-[0.08em] text-contra">✕ PREDICTION FAILED</p>
      <h2 className="mt-2 font-display text-4xl leading-none font-bold tracking-[0.05em] uppercase">Couldn’t reach the model</h2>
      <p className="mt-3 max-w-[52ch] text-[15px] text-soft">The prediction service didn’t return a valid answer. Your symptoms and answers are kept, so nothing was lost.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn btn-primary">
            Retry
          </button>
        )}
        <span className="font-mono text-xs text-muted uppercase">{message}</span>
      </div>
    </section>
  );
}

// ---------- Secondary predictions ----------

interface SecondaryProps {
  predictions: Prediction[];
  before?: Map<string, number> | null;
  deltas?: Map<string, number | null>;
  highlight: Highlight;
  onHighlight: (h: Highlight) => void;
}

export function SecondaryPredictions({ predictions, before, deltas, highlight, onHighlight }: SecondaryProps) {
  const lit = new Set(highlightedConditions(highlight));
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Other possibilities">
      <AnimatePresence mode="popLayout" initial={false}>
        {predictions.map((p) => (
          <SecondaryCard key={p.condition} p={p} before={before?.get(p.condition)} delta={deltas?.get(p.condition)} lit={lit.has(p.condition)} onHighlight={onHighlight} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

function SecondaryCard({ p, before, delta, lit, onHighlight, ref }: { p: Prediction; before?: number; delta?: number | null; lit: boolean; onHighlight: (h: Highlight) => void; ref?: Ref<HTMLLIElement> }) {
  const showBefore = before != null && Math.round(before * 100) !== pct(p.confidence);
  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={springs.layout}
      onPointerEnter={() => onHighlight({ kind: "condition", id: p.condition })}
      onPointerLeave={() => onHighlight(null)}
      tabIndex={0}
      onFocus={() => onHighlight({ kind: "condition", id: p.condition })}
      onBlur={() => onHighlight(null)}
      aria-label={`${p.condition}, ${pct(p.confidence)} percent, ${SEVERITY[p.severity].label} severity`}
      className={`hud-quiet p-3 transition-colors ${lit ? "!border-cyan" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-display text-lg font-semibold tracking-[0.05em] uppercase">{p.condition}</span>
        <SeverityTag severity={p.severity} short />
      </div>
      <p className="mt-1 flex items-baseline gap-2">
        {showBefore && (
          <>
            <span className="font-mono text-sm text-muted">{pct(before!)}%</span>
            <span className="font-mono text-muted" aria-hidden>→</span>
          </>
        )}
        <span className="font-mono text-xl font-bold">{pct(p.confidence)}%</span>
        <DeltaTag delta={showBefore ? p.confidence - before! : delta} />
      </p>
      <div className="mt-2 h-1 bg-cyan/8">
        <motion.div className="h-full bg-cyan/70" initial={{ width: 0 }} animate={{ width: `${pct(p.confidence)}%` }} transition={springs.gentle} />
      </div>
    </motion.li>
  );
}

export function RedFlagStrip({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <div role="alert" className="flex items-start gap-3 border border-contra/45 bg-contra/7 px-4 py-2.5">
      <span className="shrink-0 font-mono text-xs font-bold tracking-[0.06em] text-contra">▲ RED FLAG{flags.length > 1 ? `S · ${flags.length}` : ""}</span>
      <ul className="space-y-1 text-sm text-text">
        {flags.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
