import type { Prediction, PredictionResult } from "./predict/types";

/** Element highlighted across the cards, graph and chips. */
export type Highlight = { kind: "condition" | "symptom"; id: string } | null;

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
