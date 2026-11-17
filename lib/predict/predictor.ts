import type { PredictInput, PredictionResult, PredictorSource } from "./types";

/**
 * The single seam between the UI/API and whatever produces predictions.
 * To plug in a trained ML model: implement this interface (e.g. lib/predict/ml.ts)
 * and return it from getPredictor(). Nothing in the UI needs to change.
 */
export interface Predictor {
  readonly source: PredictorSource;
  predict(input: PredictInput, options?: { signal?: AbortSignal }): Promise<PredictionResult>;
}

/** Thrown by predictors for failures that should surface as a specific HTTP status. */
export class PredictorError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PredictorError";
  }
}

export async function getPredictor(): Promise<Predictor> {
  const forced = process.env.PREDICTOR?.trim().toLowerCase();

  const key = process.env.GROQ_API_KEY?.trim();

  // Engine switch (environment variable PREDICTOR):
  //   (unset) or "llm"/"groq" → hosted language model (default; needs GROQ_API_KEY)
  //   "ml"                    → the model trained on public data (ml/train.py; see /model)
  //   "mock"                  → rule-based demo engine
  // Without an API key the default falls back to the trained model.
  if (forced === "ml" || (!forced && !key)) {
    const { MlPredictor } = await import("./ml");
    return new MlPredictor();
  }
  if (forced === "mock") {
    const { MockPredictor } = await import("./mock");
    return new MockPredictor();
  }
  if (!key) throw new PredictorError("PREDICTOR=llm but GROQ_API_KEY is not set", 500);
  const { GroqPredictor } = await import("./groq");
  return new GroqPredictor(key, process.env.GROQ_MODEL?.trim() || undefined);
}
