"use client";

import { ReportButton } from "@/components/app/ReportButton";
import { SeverityTag } from "@/components/app/Predictions";
import { pct } from "@/lib/explain";
import type { SavedAnalysis } from "@/lib/history";
import type { Duration, Sex } from "@/lib/predict/types";

/** One saved analysis: when, top match, inputs, and its PDF report (shared by History and Patients). */
export function AnalysisCard({
  analysis: a,
  patientName,
  onDelete,
}: {
  analysis: SavedAnalysis;
  /** Shown as a tag and printed on the PDF. */
  patientName?: string;
  onDelete: (id: string) => void;
}) {
  const top = [...a.result.predictions].sort((x, y) => y.confidence - x.confidence)[0];
  return (
    <li className="hud flex flex-wrap items-center gap-5 p-4">
      <span className="w-16 shrink-0 font-mono text-2xl font-semibold text-cyan">{a.top_confidence != null ? `${pct(a.top_confidence)}%` : "—"}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">{new Date(a.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          <span className="rounded-full bg-amber/12 px-2 py-0.5 text-[11px] font-semibold text-amber">{a.source === "mock" ? "Demo mode" : "Live model"}</span>
          {patientName && <span className="rounded-full bg-cyan/12 px-2 py-0.5 text-[11px] font-semibold text-cyan">{patientName}</span>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-semibold">{a.top_condition ?? "No match"}</span>
          {top && <SeverityTag severity={top.severity} />}
        </p>
        <p className="mt-0.5 truncate text-sm text-soft">
          {a.input.symptoms.join(" · ")} · age {a.input.age} · {a.input.duration}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ReportButton
          response={{ source: a.source, result: a.result }}
          symptoms={a.input.symptoms}
          excluded={a.input.excluded ?? []}
          noEffect={a.input.noEffect ?? []}
          age={a.input.age}
          sex={a.input.sex as Sex}
          duration={a.input.duration as Duration}
          answers={a.input.answers ?? []}
          patientName={patientName}
        />
        <button
          type="button"
          onClick={() => onDelete(a.id)}
          className="btn btn-ghost !min-h-8 !px-3 hover:!bg-contra/12 hover:!text-contra"
          aria-label="Delete this saved analysis"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
