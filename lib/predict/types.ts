import type { z } from "zod";
import type {
  ContributionSchema,
  FollowUpAnswerSchema,
  FollowUpQuestionSchema,
  PredictInputSchema,
  PredictionResultSchema,
  PredictionSchema,
  DURATIONS,
  SEVERITIES,
  SEXES,
} from "./schema";

export type PredictInput = z.infer<typeof PredictInputSchema>;
export type FollowUpAnswer = z.infer<typeof FollowUpAnswerSchema>;
export type PredictionResult = z.infer<typeof PredictionResultSchema>;
export type Prediction = z.infer<typeof PredictionSchema>;
export type Contribution = z.infer<typeof ContributionSchema>;
export type FollowUpQuestion = z.infer<typeof FollowUpQuestionSchema>;
export type Sex = (typeof SEXES)[number];
export type Duration = (typeof DURATIONS)[number];
export type Severity = (typeof SEVERITIES)[number];

/** Which implementation produced a result. Extend when adding e.g. "ml". */
export type PredictorSource = "mock" | "groq";

/** What /api/predict returns on success. */
export interface PredictResponse {
  source: PredictorSource;
  result: PredictionResult;
}

/** What /api/predict returns on failure. */
export interface PredictErrorResponse {
  error: string;
  details?: unknown;
}
