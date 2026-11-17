# Explainable Symptom Predictor

Educational demo of an explainable AI symptom → condition predictor. **Not medical advice.**

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. With `GROQ_API_KEY` set (copy `.env.example` to `.env.local`), predictions come from a hosted
language model. Without a key, the app uses its **model trained on public data** (multinomial logistic regression over
377 symptoms and 773 diseases): training code in [`ml/`](ml/README.md), exported weights in `lib/predict/model/`, and a
write-up with the data source, algorithms compared and verification results at `/model` in the app.

`PREDICTOR=llm|ml|mock` forces an engine (`mock` is the rule-based demo engine).

## API

`POST /api/predict`

```json
{ "symptoms": ["Fever", "Cough"], "age": 30, "sex": "female", "duration": "1-3d",
  "answers": [{ "question": "...", "answer": "yes" }] }
```

`duration` is one of `<24h`, `1-3d`, `4-7d`, `1-4w`, `>1m`. `answers` is optional.

Response: `{ source: "ml" | "mock" | "groq", result: { predictions, reasoning_steps, red_flags, follow_up_questions } }` —
the result shape is defined and validated in `lib/predict/schema.ts`. Invalid input returns 400 with zod issues.

## Prediction engines

All prediction goes through one interface in `lib/predict/predictor.ts`:

```ts
interface Predictor {
  readonly source: PredictorSource;
  predict(input: PredictInput, options?: { signal?: AbortSignal }): Promise<PredictionResult>;
}
```

`lib/predict/groq.ts` (language model, default), `lib/predict/ml.ts` (trained model) and `lib/predict/mock.ts` implement it, and
`getPredictor()` picks one. The UI only talks to `/api/predict`, so engines can be swapped without UI changes.

## Training and verification

```bash
python -m venv ml/.venv && ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
ml/.venv/Scripts/python ml/download.py   # Mendeley "Disease and symptoms dataset 2023", CC BY 4.0, checksum-verified
ml/.venv/Scripts/python ml/train.py      # compares 7 algorithms, exports logistic regression (about 10 min)
ml/.venv/Scripts/python ml/verify.py     # held-out test, 5-fold cross-validation, calibration, external dataset
```

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
- `lib/predict/ml.ts` – trained-model predictor; weights and reports in `lib/predict/model/`
- `ml/` – Python training (`train.py`) and verification (`verify.py`)
- `lib/predict/mock.ts` – deterministic rule-based demo predictor (development)
- `lib/predict/groq.ts` – hosted language-model predictor (default when `GROQ_API_KEY` is set)
- `lib/symptoms.ts` – symptom catalog by body region
- `lib/api.ts` – typed client used by the UI
- `app/api/predict/route.ts` – API route
