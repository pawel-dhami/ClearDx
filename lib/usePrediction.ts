"use client";

import { useCallback, useRef, useState } from "react";
import { fetchPrediction, PredictRequestError } from "./api";
import type { PredictInput, PredictResponse } from "./predict/types";

export const inputKey = (i: PredictInput) => JSON.stringify([i.symptoms, i.age, i.sex, i.duration, i.answers ?? []]);

interface State {
  response: PredictResponse | null;
  /** The result before the current one, used to show confidence deltas. */
  previous: PredictResponse | null;
  /** Last result computed with every symptom included: the "before" for what-if comparisons. */
  baseline: PredictResponse | null;
}

/** Runs predictions, cancelling any in-flight request when a newer one starts. */
export function usePrediction() {
  const [state, setState] = useState<State>({ response: null, previous: null, baseline: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const lastKey = useRef<string | null>(null);

  const run = useCallback(async (input: PredictInput, opts?: { skipIfUnchanged?: boolean; asBaseline?: boolean }) => {
    const key = inputKey(input);
    if (opts?.skipIfUnchanged && key === lastKey.current) return;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    lastKey.current = key;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPrediction(input, c.signal);
      if (!c.signal.aborted)
        setState((s) => ({ response: res, previous: s.response, baseline: opts?.asBaseline ? res : s.baseline }));
    } catch (e) {
      if (c.signal.aborted) return;
      lastKey.current = null; // allow retrying the same input
      setError(e instanceof PredictRequestError ? `${e.message}${e.status ? ` · ${e.status}` : ""}` : "Couldn't reach the prediction service.");
    } finally {
      if (controller.current === c) setLoading(false);
    }
  }, []);

  return { ...state, loading, error, run };
}
