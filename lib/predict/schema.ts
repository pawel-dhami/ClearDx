import { z } from "zod";

export const SEXES = ["male", "female", "other"] as const;
export const DURATIONS = ["<24h", "1-3d", "4-7d", "1-4w", ">1m"] as const;
export const SEVERITIES = ["low", "moderate", "high", "emergency"] as const;

export const DURATION_LABELS: Record<(typeof DURATIONS)[number], string> = {
  "<24h": "Less than 24 hours",
  "1-3d": "1–3 days",
  "4-7d": "4–7 days",
  "1-4w": "1–4 weeks",
  ">1m": "More than a month",
};

// ---------- Input ----------

export const FollowUpAnswerSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(300),
});

export const PredictInputSchema = z.object({
  symptoms: z
    .array(z.string().trim().min(1).max(100))
    .min(1, "Select at least one symptom")
    .max(30),
  age: z.int().min(0).max(120),
  sex: z.enum(SEXES),
  duration: z.enum(DURATIONS),
  /** Answers to previously returned follow-up questions; used to refine the prediction. */
  answers: z.array(FollowUpAnswerSchema).max(20).optional(),
});

// ---------- Output (the exact shape every predictor must return) ----------

export const ContributionSchema = z.object({
  symptom: z.string().min(1),
  weight: z.number().min(-1).max(1),
  reason: z.string().min(1),
});

export const PredictionSchema = z.object({
  condition: z.string().min(1),
  confidence: z.number().min(0).max(1),
  severity: z.enum(SEVERITIES),
  contributions: z.array(ContributionSchema),
});

export const FollowUpQuestionSchema = z.object({
  question: z.string().min(1),
  why_it_matters: z.string().min(1),
});

export const PredictionResultSchema = z.object({
  predictions: z.array(PredictionSchema).min(1),
  reasoning_steps: z.array(z.string().min(1)),
  red_flags: z.array(z.string()),
  follow_up_questions: z.array(FollowUpQuestionSchema),
});
