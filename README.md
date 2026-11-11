# Explainable Symptom Predictor

Educational demo of an explainable AI symptom → condition predictor. **Not medical advice.**

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no API key the app runs in **mock mode** (deterministic, rule-based fake data).

To use Groq, copy `.env.example` to `.env.local` and set `GROQ_API_KEY`. Optional: `GROQ_MODEL` (default `openai/gpt-oss-120b`), `PREDICTOR=mock|groq` to force one.

## API

`POST /api/predict`

```json
{ "symptoms": ["Fever", "Cough"], "age": 30, "sex": "female", "duration": "1-3d",
  "answers": [{ "question": "...", "answer": "yes" }] }
```

`duration` is one of `<24h`, `1-3d`, `4-7d`, `1-4w`, `>1m`. `answers` is optional.

Response: `{ source: "mock" | "groq", result: { predictions, reasoning_steps, red_flags, follow_up_questions } }` —
the result shape is defined and validated in `lib/predict/schema.ts`. Invalid input returns 400 with zod issues.

## Swapping in a trained model

All prediction goes through one interface in `lib/predict/predictor.ts`:

```ts
interface Predictor {
  readonly source: PredictorSource;
  predict(input: PredictInput, options?: { signal?: AbortSignal }): Promise<PredictionResult>;
}
```

Add e.g. `lib/predict/ml.ts` implementing it, add its name to `PredictorSource`, and return it from `getPredictor()`.
The UI only talks to `/api/predict`, so nothing else changes.

## Features

- **Body map:** 3D (React Three Fiber) on larger screens, 2D SVG on phones or without WebGL; toggle in the corner. Region buttons below the figure cover every region (including skin and whole-body) and are the keyboard path.
- **Symptom chips:** drag to rank (most bothersome first), arrow keys to reorder, Delete to remove.
- **Prediction cards:** animated confidence rings, spring re-ranking, ▲/▼ deltas vs the previous run, click to expand per-symptom contributions.
- **Contribution graph:** d3-force layout; edge width = weight, green supports, red dashed contradicts. Hover (or focus, or tap on narrow screens) to see reasons.
- **What-if mode:** tap chips to include/exclude; any change re-runs the prediction after 600 ms and cancels in-flight requests.
- **Reasoning timeline** with a typewriter reveal, and **follow-up questions** that refine the prediction (answers can be undone).

## Accessibility

- Honours `prefers-reduced-motion`: no 3D idle/scan movement, graph settles without visible physics, typewriter shows all steps.
- One concise live-region announcement per result; full-text alternatives for the typewriter and a screen-reader table for the graph.
- Skip link to results; focus moves into the symptom picker and back to its opener; ARIA radio groups with arrow keys; visible focus rings throughout.

## Layout

- `lib/predict/schema.ts` – zod schemas for input and output
- `lib/predict/groq.ts` – Groq JSON-mode predictor (validates, retries once with the validation error)
- `lib/predict/mock.ts` – deterministic mock predictor
- `lib/symptoms.ts` – symptom catalog by body region
- `lib/api.ts` – typed client used by the UI
- `app/api/predict/route.ts` – API route
