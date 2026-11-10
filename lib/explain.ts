import type { Prediction, PredictionResult } from "./predict/types";

/**
 * Element(s) highlighted across the body, chips, cards and graph.
 * - symptom / condition: hover or focus on one item
 * - refs: a reasoning step selected; lights every symptom and condition it mentions
 */
export type Highlight =
  | { kind: "condition" | "symptom"; id: string }
  | { kind: "refs"; symptoms: string[]; conditions: string[] }
  | null;

export const highlightedSymptoms = (h: Highlight): string[] =>
  !h ? [] : h.kind === "symptom" ? [h.id] : h.kind === "refs" ? h.symptoms : [];
export const highlightedConditions = (h: Highlight): string[] =>
  !h ? [] : h.kind === "condition" ? [h.id] : h.kind === "refs" ? h.conditions : [];

export interface Delta {
  /** Change in confidence (0–1 scale); null when the condition is new. */
  delta: number | null;
}

export interface Comparison {
  deltas: Map<string, Delta>;
  /** Conditions that were in the previous result but dropped out. */
  dropped: Prediction[];
}

export function compare(current: PredictionResult, previous: PredictionResult | null | undefined): Comparison | null {
  if (!previous) return null;
  const prev = new Map(previous.predictions.map((p) => [p.condition, p]));
  const deltas = new Map<string, Delta>();
  for (const p of current.predictions) {
    const before = prev.get(p.condition);
    deltas.set(p.condition, { delta: before ? p.confidence - before.confidence : null });
  }
  const now = new Set(current.predictions.map((p) => p.condition));
  const dropped = previous.predictions.filter((p) => !now.has(p.condition));
  return { deltas, dropped };
}

export const pct = (n: number) => Math.round(n * 100);

export const sortByConfidence = (r: PredictionResult) => [...r.predictions].sort((a, b) => b.confidence - a.confidence);

/** Symptoms that were sent but don't contribute to any returned condition. */
export function noEffectSymptoms(result: PredictionResult, sent: string[]): string[] {
  const used = new Set(result.predictions.flatMap((p) => p.contributions.map((c) => c.symptom.toLowerCase())));
  return sent.filter((s) => !used.has(s.toLowerCase()));
}

/**
 * Which symptoms and conditions a free-text reasoning step mentions.
 * Works for mock and model output alike (plain case-insensitive matching).
 */
export function referencesIn(step: string, symptoms: string[], conditions: string[]) {
  const text = step.toLowerCase();
  const has = (label: string) => text.includes(label.toLowerCase());
  return { symptoms: symptoms.filter(has), conditions: conditions.filter(has) };
}
