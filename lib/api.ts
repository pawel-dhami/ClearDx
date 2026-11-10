import type { PredictErrorResponse, PredictInput, PredictResponse } from "@/lib/predict/types";

export class PredictRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PredictRequestError";
  }
}

/** Typed client for /api/predict. Pass an AbortSignal to cancel superseded requests (what-if mode). */
export async function fetchPrediction(input: PredictInput, signal?: AbortSignal): Promise<PredictResponse> {
  const res = await fetch("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const data = (await res.json().catch(() => null)) as PredictResponse | PredictErrorResponse | null;
  if (!res.ok || !data || "error" in data) {
    const err = data && "error" in data ? data : null;
    throw new PredictRequestError(err?.error ?? `Request failed (${res.status})`, res.status, err?.details);
  }
  return data;
}
