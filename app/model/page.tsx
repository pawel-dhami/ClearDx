import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { PanelTitle } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";
import report from "@/lib/predict/model/training-report.json";
import verification from "@/lib/predict/model/verification.json";

export const metadata: Metadata = {
  title: "Model & data",
  description: "Where ClearDx's trained model gets its data, which algorithms were used to train it, and how its results are verified.",
};

const GITHUB = "https://github.com/pawel-dhami/ClearDx";
const n = (v: number) => v.toLocaleString("en-GB");
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function ModelPage() {
  const d = report.dataset;
  const best = Math.max(...report.models.map((m) => m.top1_accuracy));
  const chosen = report.models.find((m) => m.key === report.chosen.key)!;
  const v = verification;
  const ext = v.external;

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Nav
        right={
          <Link href="/app" className="btn btn-primary">
            Launch app
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-8">
        <p className="label mb-2">Under the hood</p>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Model &amp; data</h1>
        <p className="mt-4 max-w-[70ch] text-[15px] text-soft">
          ClearDx&apos;s predictions come from a model trained from scratch on a public dataset of {n(d.rows)} symptom–disease cases. This page lists
          where the data comes from, how it was prepared, which algorithms were compared, and how the results were verified.
        </p>

        {/* ---------- key numbers ---------- */}
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Training cases", n(d.rows)],
            ["Diseases", n(d.diseases)],
            ["Symptoms", n(d.symptoms)],
            ["Top-3 accuracy (unseen cases)", pct(chosen.top3_accuracy)],
          ].map(([k, v]) => (
            <div key={k} className="hud p-4">
              <dt className="label">{k}</dt>
              <dd className="mt-1 font-mono text-2xl font-semibold text-cyan">{v}</dd>
            </div>
          ))}
        </dl>

        {/* ---------- data ---------- */}
        <section aria-labelledby="data-title" className="hud mt-4 flex flex-col gap-3 p-4">
          <PanelTitle id="data-title">Where the data comes from</PanelTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <dl className="space-y-2 text-sm">
              {[
                ["Dataset", d.name],
                ["Publisher", d.publisher],
                ["DOI", d.doi],
                ["Licence", d.licence],
                ["Rows", `${n(d.rows)} (${n(d.unique_rows)} unique, ${n(d.duplicate_rows)} repeats)`],
                ["Symptoms per case", `${d.mean_symptoms_per_row} on average`],
                ["Cases per disease", `${d.rows_per_disease.min} to ${n(d.rows_per_disease.max)} (median ${d.rows_per_disease.median})`],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <dt className="w-36 shrink-0 text-muted">{k}</dt>
                  <dd className="min-w-0 text-text">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3 text-sm text-soft">
              <p>
                Each row is one case: a disease and the symptoms present, recorded as yes/no across {d.symptoms} symptom columns. Diseases that are more
                common in the real world have more rows, so the model also learns how likely each disease is to begin with.
              </p>
              <p className="rounded-xl bg-amber/10 px-3.5 py-2.5 text-text">
                <span className="font-semibold text-amber">Synthetic data.</span> The publisher states the cases were artificially generated to preserve
                symptom severity and how often each disease occurs. They are not real patient records.
              </p>
              <a href={d.url} className="inline-flex text-cyan underline-offset-2 hover:underline">
                View the dataset on Mendeley Data ↗
              </a>
            </div>
          </div>
        </section>

        {/* ---------- method ---------- */}
        <section aria-labelledby="method-title" className="hud mt-4 flex flex-col gap-3 p-4">
          <PanelTitle id="method-title">How it was trained</PanelTitle>
          <ol className="grid gap-3 text-sm text-soft md:grid-cols-2">
            {[
              ["Download and verify", "The CSV is downloaded from Mendeley Data and checked against its published SHA-256 checksum."],
              ["Encode", `Every case becomes a vector of ${d.symptoms} yes/no symptom values; the disease name is the label to predict.`],
              [
                "Split without leaks",
                `${pct(d.duplicate_rows / d.rows)} of rows are exact repeats, so the ${Math.round(report.split.test_fraction * 100)}% test set is split by unique case: no identical symptom pattern appears in both training (${n(report.split.train_rows)} rows) and testing (${n(report.split.test_rows)} rows).`,
              ],
              ["Compare algorithms", `${report.models.length} algorithms are trained on the same data and scored on the same held-out cases, within a ${30}-minute budget for the whole run.`],
              ["Export", "The chosen model's weights are rounded, near-zero weights are dropped, and the result is saved as a small JSON file the app reads directly; no Python is needed at runtime."],
              ["Check the export", `The exported file is re-scored on the test set to confirm rounding didn't change its accuracy (${pct(report.chosen.exported_top1_accuracy)} top-1).`],
            ].map(([title, body], i) => (
              <li key={title} className="rounded-xl bg-fill p-3.5">
                <span className="mb-1.5 grid size-6 place-items-center rounded-full bg-[var(--accent-fill)] text-xs font-semibold text-white">{i + 1}</span>
                <span className="block font-medium text-text">{title}</span>
                {body}
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- results ---------- */}
        <section aria-labelledby="algo-title" className="hud mt-4 flex flex-col gap-3 p-4">
          <PanelTitle id="algo-title">Algorithms compared</PanelTitle>
          <p className="text-sm text-soft">
            Scored on {n(report.split.test_rows)} held-out cases. <b className="font-medium text-text">Top-1</b>: the right disease ranked first.{" "}
            <b className="font-medium text-text">Top-3 / Top-5</b>: within the first three or five. <b className="font-medium text-text">Macro-F1</b>: average
            across all diseases, so rare diseases count as much as common ones.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  {["Algorithm", "Top-1", "Top-3", "Top-5", "Macro-F1", "Training time"].map((h, i) => (
                    <th key={h} scope="col" className={`border-b border-line px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.models.map((m) => {
                  const isChosen = m.key === report.chosen.key;
                  return (
                    <tr key={m.key} className={isChosen ? "bg-cyan/10" : ""}>
                      <th scope="row" className="border-b border-line px-3 py-2.5 text-left font-medium text-text">
                        {m.name}
                        {isChosen && <span className="ml-2 rounded-full bg-[var(--accent-fill)] px-2 py-0.5 text-[11px] font-semibold text-white">Used in the app</span>}
                      </th>
                      {[m.top1_accuracy, m.top3_accuracy, m.top5_accuracy].map((v, i) => (
                        <td key={i} className={`border-b border-line px-3 py-2.5 text-right font-mono ${i === 0 && v === best ? "font-semibold text-support" : "text-soft"}`}>
                          {pct(v)}
                        </td>
                      ))}
                      <td className="border-b border-line px-3 py-2.5 text-right font-mono text-soft">{m.macro_f1.toFixed(3)}</td>
                      <td className="border-b border-line px-3 py-2.5 text-right font-mono text-soft">
                        {m.key === "knn" ? "— stores cases" : m.fit_seconds < 60 ? `${m.fit_seconds}s` : `${(m.fit_seconds / 60).toFixed(1)} min`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Whole run: {report.total_training_minutes} minutes on {report.environment.cpu_cores} CPU cores · Python {report.environment.python} · scikit-learn{" "}
            {report.environment.scikit_learn} · trained {report.generated}.
          </p>
        </section>

        {/* ---------- verification ---------- */}
        <section aria-labelledby="verify-title" className="hud mt-4 flex flex-col gap-3 p-4">
          <PanelTitle id="verify-title">How the results are verified</PanelTitle>
          <p className="max-w-[80ch] text-sm text-soft">
            Every number below is measured on the exact model file the app uses, by a separate script (
            <a href={`${GITHUB}/blob/main/ml/verify.py`} className="text-cyan underline-offset-2 hover:underline">
              ml/verify.py
            </a>
            ) that anyone can re-run. Each check answers a different question.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-fill p-3.5 text-sm text-soft">
              <p className="font-medium text-text">1 · Unseen test cases</p>
              <p className="mt-1">Does it work on cases it never trained on?</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-cyan">{pct(v.holdout.top1_accuracy)}</p>
              <p>
                right disease ranked first on {n(v.holdout.cases)} held-out cases ({pct(v.holdout.top3_accuracy)} within the top 3). Always guessing the most
                common disease would score {pct(v.holdout.baseline_most_common_top1)}.
              </p>
            </div>
            <div className="rounded-xl bg-fill p-3.5 text-sm text-soft">
              <p className="font-medium text-text">2 · Five-fold cross-validation</p>
              <p className="mt-1">Is that score stable, or one lucky split?</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-cyan">
                {pct(v.cross_validation.top1_mean)} <span className="text-base font-normal text-muted">± {(v.cross_validation.top1_std * 100).toFixed(1)}</span>
              </p>
              <p>
                The model was retrained five times, each time tested on a different fifth of the data (no identical case in both). Folds:{" "}
                {v.cross_validation.folds.map((f) => pct(f.top1_accuracy)).join(", ")}.
              </p>
            </div>
            <div className="rounded-xl bg-fill p-3.5 text-sm text-soft">
              <p className="font-medium text-text">3 · Calibration</p>
              <p className="mt-1">When it says 60%, is it right about 60% of the time?</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-cyan">{(v.calibration.expected_calibration_error * 100).toFixed(1)}%</p>
              <p>average gap between stated confidence and actual accuracy (expected calibration error; 0% is perfect).</p>
              <div className="mt-3 space-y-1.5" role="img" aria-label="Stated confidence compared with actual accuracy, by confidence band">
                {v.calibration.bins
                  .filter((b) => b.cases >= 50)
                  .map((b) => (
                    <div key={b.from} className="grid grid-cols-[64px_1fr_44px] items-center gap-2 font-mono text-[11px]">
                      <span className="text-muted">
                        {Math.round(b.from * 100)}–{Math.round(b.to * 100)}%
                      </span>
                      <span className="relative h-2.5 overflow-hidden rounded-full bg-[var(--fill-hover)]">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent-fill)]" style={{ width: `${b.accuracy * 100}%` }} />
                        <span className="absolute inset-y-0 w-0.5 bg-text" style={{ left: `${b.mean_confidence * 100}%` }} />
                      </span>
                      <span className="text-right text-text">{Math.round(b.accuracy * 100)}%</span>
                    </div>
                  ))}
                <p className="pt-1 text-[11px] text-muted">Bar: how often the top pick was right · line: the confidence it stated.</p>
              </div>
            </div>
            <div className="rounded-xl bg-fill p-3.5 text-sm text-soft">
              <p className="font-medium text-text">4 · A different dataset</p>
              <p className="mt-1">Does it generalise beyond its own training data?</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-cyan">{pct(ext.top5_accuracy)}</p>
              <p>
                correct diagnosis within the top 5 on {n(ext.cases_used)} written patient descriptions from{" "}
                <a href={ext.url} className="text-cyan underline-offset-2 hover:underline">
                  {ext.name}
                </a>{" "}
                ({ext.licence}), a separate public dataset the model never saw ({pct(ext.top1_accuracy)} first, {pct(ext.top3_accuracy)} top 3; picking 5 of{" "}
                {n(d.diseases)} diseases at random would score {pct(ext.chance_top5)}).
              </p>
              <p className="mt-2 rounded-lg bg-amber/10 px-3 py-2 text-text">
                <span className="font-semibold text-amber">What this shows:</span> about {Math.round(ext.top5_accuracy / ext.chance_top5)}× better than chance,
                but far below the {pct(v.holdout.top5_accuracy)} top-5 score on its own data. Symptoms were pulled from free text by simple phrase matching (
                {ext.mean_symptoms_extracted} per description; none found in {ext.cases_with_no_symptom_found}), and the model learned synthetic patterns, so it
                generalises to real-style descriptions only partly.
              </p>
            </div>
          </div>
          <details className="rounded-xl bg-fill p-3.5 text-sm text-soft">
            <summary className="cursor-pointer font-medium text-text">External test by diagnosis (top-3 accuracy)</summary>
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {ext.per_diagnosis.map((r) => (
                <li key={r.diagnosis} className="flex items-center justify-between gap-3">
                  <span className="truncate first-letter:uppercase">{r.diagnosis}</span>
                  <span className="font-mono text-text">{pct(r.top3_accuracy)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              {ext.diagnoses_used} of 22 diagnoses could be matched to the training data&apos;s disease list; &quot;jaundice&quot; is a symptom rather than a
              diagnosis and was left out.
            </p>
          </details>
          <p className="text-xs text-muted">
            In the app, every result also says how often predictions at that confidence were right in this testing (see the last steps of the reasoning).
          </p>
        </section>

        {/* ---------- chosen ---------- */}
        <section aria-labelledby="chosen-title" className="hud mt-4 flex flex-col gap-3 p-4">
          <PanelTitle id="chosen-title">Why logistic regression powers the app</PanelTitle>
          <div className="grid gap-4 text-sm text-soft md:grid-cols-2">
            <div className="space-y-3">
              <p>{report.chosen.reason}</p>
              <p>
                For each disease the model adds up one weight per symptom you have, then turns the totals into probabilities. Those same weights are what
                the app draws as lines in its &quot;Why&quot; graph: a positive weight supports the disease, a negative one argues against it.
              </p>
            </div>
            <div className="space-y-3">
              <p className="rounded-xl bg-fill px-3.5 py-3 font-mono text-[13px] text-text">
                score(disease) = bias + Σ weight(symptom, disease)
                <br />
                probability = softmax(scores)
              </p>
              <p>
                The exported file keeps {n(report.chosen.non_zero_weights)} weights (those at least {report.chosen.pruned_below} in size) and still ranks the
                right disease first in {pct(report.chosen.exported_top1_accuracy)} of test cases.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- limits ---------- */}
        <section aria-labelledby="limits-title" className="hud mt-4 flex flex-col gap-3 p-4">
          <PanelTitle id="limits-title">Limitations</PanelTitle>
          <ul className="grid gap-2 text-sm text-soft md:grid-cols-2">
            {[
              "Trained on synthetic cases: 86% within its own data, but only 14% top-5 on an independent dataset of written descriptions, so real-world accuracy is much lower than the in-dataset figure.",
              "The data has no age, sex or symptom duration, so this model ignores them.",
              "App symptoms are matched to the dataset's wording (e.g. “Chest pain” → “sharp chest pain”); two app symptoms have no match and carry no weight in this model.",
              "With only a few symptoms, many of the 773 diseases look alike, so probabilities spread thinly until more symptoms or follow-up answers are added.",
              "The dataset has no severity labels; the app assigns low / moderate / high / emergency from a conservative keyword list.",
              "Like everything in ClearDx it is an educational demo, not a diagnosis or medical advice.",
            ].map((t) => (
              <li key={t} className="rounded-xl bg-fill px-3.5 py-2.5">
                {t}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- reproduce ---------- */}
        <section aria-labelledby="repro-title" className="hud mt-4 flex flex-col gap-3 p-4">
          <PanelTitle id="repro-title">Reproduce it</PanelTitle>
          <p className="text-sm text-soft">
            The training code is in the{" "}
            <a href={`${GITHUB}/tree/main/ml`} className="text-cyan underline-offset-2 hover:underline">
              ml folder on GitHub
            </a>
            . From the project root:
          </p>
          <pre className="overflow-x-auto rounded-xl bg-fill px-4 py-3 font-mono text-[13px] text-text">
            {`python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt   # macOS/Linux: ml/.venv/bin/python
ml/.venv/Scripts/python ml/download.py
ml/.venv/Scripts/python ml/train.py`}
          </pre>
          <p className="text-sm text-soft">
            This is the model the live app uses for every analysis.
          </p>
        </section>
      </main>
      <Disclaimer className="mx-4 mb-4 sm:mx-8" />
    </div>
  );
}
