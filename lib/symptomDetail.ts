import type { FollowUpAnswer } from "./predict/types";

/**
 * Optional extra detail a user can log for any symptom. It travels to the
 * predictor as ordinary follow-up answers ("Symptom detail: <label>"), so the
 * API contract stays the same and every predictor can use it.
 */
export interface SymptomDetail {
  severity?: "mild" | "moderate" | "severe";
  onset?: "sudden" | "gradual";
  pattern?: "constant" | "comes-and-goes" | "worsening";
  side?: "left" | "right" | "both";
  note?: string;
}

export const SEVERITY_OPTIONS = ["mild", "moderate", "severe"] as const;
export const ONSET_OPTIONS = ["sudden", "gradual"] as const;
export const PATTERN_OPTIONS = ["constant", "comes-and-goes", "worsening"] as const;
export const SIDE_OPTIONS = ["left", "right", "both"] as const;
export const NOTE_MAX = 120;

export const DETAIL_LABELS: Record<string, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
  sudden: "Sudden",
  gradual: "Gradual",
  constant: "Constant",
  "comes-and-goes": "Comes and goes",
  worsening: "Getting worse",
  left: "Left",
  right: "Right",
  both: "Both sides",
};

export const DETAIL_PREFIX = "Symptom detail: ";

export const hasDetail = (d?: SymptomDetail) => !!d && Object.values(d).some((v) => v !== undefined && v !== "");

/** Short summary for a chip, e.g. "Severe · sudden · left". */
export function summarize(d?: SymptomDetail): string {
  if (!d) return "";
  const parts = [d.severity, d.onset, d.pattern, d.side].filter(Boolean).map((v) => DETAIL_LABELS[v!].toLowerCase());
  if (parts[0]) parts[0] = parts[0][0].toUpperCase() + parts[0].slice(1);
  if (d.note) parts.push("note");
  return parts.join(" · ");
}

/** "severity: severe; onset: sudden; pattern: comes and goes; side: left; note: worse at night" */
function describe(d: SymptomDetail): string {
  const bits: string[] = [];
  if (d.severity) bits.push(`severity: ${d.severity}`);
  if (d.onset) bits.push(`onset: ${d.onset}`);
  if (d.pattern) bits.push(`pattern: ${DETAIL_LABELS[d.pattern].toLowerCase()}`);
  if (d.side) bits.push(`side: ${d.side}`);
  if (d.note?.trim()) bits.push(`note: ${d.note.trim().slice(0, NOTE_MAX)}`);
  return bits.join("; ");
}

/** Details for the symptoms being sent, as follow-up answers (at most `max`). */
export function detailsToAnswers(symptoms: string[], details: Record<string, SymptomDetail>, max = 12): FollowUpAnswer[] {
  return symptoms
    .filter((s) => hasDetail(details[s]))
    .slice(0, max)
    .map((s) => ({ question: `${DETAIL_PREFIX}${s}`.slice(0, 300), answer: describe(details[s]).slice(0, 300) }));
}

/** Reads detail answers back (used by the built-in rule-based predictor). */
export function parseDetailAnswers(answers: FollowUpAnswer[]): Map<string, SymptomDetail> {
  const out = new Map<string, SymptomDetail>();
  for (const a of answers) {
    if (!a.question.startsWith(DETAIL_PREFIX)) continue;
    const label = a.question.slice(DETAIL_PREFIX.length).trim().toLowerCase();
    const d: SymptomDetail = {};
    for (const part of a.answer.split(";")) {
      const [k, ...rest] = part.split(":");
      const v = rest.join(":").trim().toLowerCase();
      switch (k.trim().toLowerCase()) {
        case "severity":
          if ((SEVERITY_OPTIONS as readonly string[]).includes(v)) d.severity = v as SymptomDetail["severity"];
          break;
        case "onset":
          if ((ONSET_OPTIONS as readonly string[]).includes(v)) d.onset = v as SymptomDetail["onset"];
          break;
        case "pattern":
          d.pattern = v === "comes and goes" ? "comes-and-goes" : v === "getting worse" ? "worsening" : v === "constant" ? "constant" : undefined;
          break;
        case "side":
          if ((SIDE_OPTIONS as readonly string[]).includes(v)) d.side = v as SymptomDetail["side"];
          break;
        case "note":
          d.note = rest.join(":").trim();
          break;
      }
    }
    out.set(label, d);
  }
  return out;
}

/** True for answers that carry symptom details rather than replies to follow-up questions. */
export const isDetailAnswer = (a: FollowUpAnswer) => a.question.startsWith(DETAIL_PREFIX);
