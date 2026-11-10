import { z } from "zod";
import { PredictorError, type Predictor } from "./predictor";
import { DURATION_LABELS, PredictionResultSchema } from "./schema";
import type { PredictInput, PredictionResult } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are the reasoning engine of an EDUCATIONAL symptom-explainer demo. You are not a doctor and your output is not medical advice.

Given a patient's symptoms, age, sex, symptom duration and optional answers to follow-up questions, return ONLY a JSON object with exactly this shape:

{
  "predictions": [
    {
      "condition": string,                 // common name of the condition
      "confidence": number,                // 0 to 1, how well the symptoms fit; independent per condition, need not sum to 1
      "severity": "low" | "moderate" | "high" | "emergency",
      "contributions": [
        { "symptom": string,               // MUST be copied exactly from the input symptom list
          "weight": number,                // -1 to 1; positive supports the condition, negative argues against it
          "reason": string }               // one short sentence explaining the weight
      ]
    }
  ],
  "reasoning_steps": [string],             // 4-7 short, ordered steps describing how you reached the ranking
  "red_flags": [string],                   // warning signs needing urgent care; empty array if none
  "follow_up_questions": [
    { "question": string,                  // a yes/no question that would best discriminate between the top predictions
      "why_it_matters": string }
  ]
}

Rules:
- Return 3 to 5 predictions sorted by confidence, highest first.
- Every prediction must include a contribution for each input symptom that is relevant to it, including contradicting ones (negative weight).
- Use only lowercase severity values from the list above.
- Return 2 to 4 follow-up questions; do not repeat questions the user has already answered.
- Be conservative and calibrated: avoid confidence above 0.9.
- Output JSON only. No markdown, no prose outside the JSON.`;

function userMessage(input: PredictInput): string {
  const lines = [
    `Symptoms (most bothersome first): ${JSON.stringify(input.symptoms)}`,
    `Age: ${input.age}`,
    `Sex: ${input.sex}`,
    `Duration: ${DURATION_LABELS[input.duration]}`,
  ];
  if (input.answers?.length) {
    lines.push("Answers to follow-up questions:");
    for (const a of input.answers) lines.push(`- Q: ${a.question}\n  A: ${a.answer}`);
  }
  return lines.join("\n");
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export class GroqPredictor implements Predictor {
  readonly source = "groq" as const;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async predict(input: PredictInput, options?: { signal?: AbortSignal }): Promise<PredictionResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage(input) },
    ];

    let lastError = "";
    // First attempt + one retry that feeds the validation error back to the model.
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.complete(messages, options?.signal);
      const parsed = parseAndValidate(raw);
      if (parsed.ok) return normalize(parsed.value, input);

      lastError = parsed.error;
      messages.push(
        { role: "assistant", content: raw },
        {
          role: "user",
          content: `Your previous response did not match the required JSON shape:\n${parsed.error}\nReturn the corrected JSON object only.`,
        },
      );
    }
    throw new PredictorError("Model returned an invalid response twice", 502, lastError);
  }

  private async complete(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (err) {
      if (timeout.aborted) throw new PredictorError("Groq request timed out", 504);
      throw err;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const status = res.status === 401 || res.status === 403 ? 500 : res.status === 429 ? 429 : 502;
      throw new PredictorError(`Groq API error (${res.status})`, status, body.slice(0, 500));
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new PredictorError("Groq returned an empty response", 502);
    return content;
  }
}

function parseAndValidate(raw: string): { ok: true; value: PredictionResult } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const result = PredictionResultSchema.safeParse(json);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: z.prettifyError(result.error) };
}

/** Light clean-up that doesn't change meaning: sort, and drop contributions for symptoms the user never gave. */
function normalize(result: PredictionResult, input: PredictInput): PredictionResult {
  const given = new Map(input.symptoms.map((s) => [s.toLowerCase(), s]));
  return {
    ...result,
    predictions: [...result.predictions]
      .sort((a, b) => b.confidence - a.confidence)
      .map((p) => ({
        ...p,
        contributions: p.contributions
          .filter((c) => given.has(c.symptom.toLowerCase()))
          .map((c) => ({ ...c, symptom: given.get(c.symptom.toLowerCase())! })),
      })),
  };
}
