import { findSymptom, REGION_LABELS, type Region } from "@/lib/symptoms";
import { isDetailAnswer, parseDetailAnswers } from "@/lib/symptomDetail";
import type { Predictor } from "./predictor";
import { DURATION_LABELS } from "./schema";
import type {
  Contribution,
  Duration,
  FollowUpQuestion,
  PredictInput,
  Prediction,
  PredictionResult,
  Severity,
  Sex,
} from "./types";

/**
 * Deterministic, rule-based stand-in for a real model.
 * Not medically validated: the weights are hand-written to produce plausible,
 * explainable output so the UI can be built and demoed without an API key.
 */

type Weight = number | [weight: number, reason: string];

interface FollowUpDef extends FollowUpQuestion {
  /** Confidence adjustment applied to this condition when answered yes / no. */
  yes: number;
  no: number;
}

interface ConditionDef {
  name: string;
  severity: Severity;
  weights: Record<string, Weight>;
  /** If set, at least one of these must be present or confidence is heavily discounted. */
  key?: string[];
  duration?: Partial<Record<Duration, number>>;
  demographics?: (age: number, sex: Sex) => { factor: number; note: string } | null;
  followUps: FollowUpDef[];
}

const SHORT: Partial<Record<Duration, number>> = { "<24h": 1.1, "1-3d": 1.15, "4-7d": 1, "1-4w": 0.6, ">1m": 0.25 };
const LONG: Partial<Record<Duration, number>> = { "<24h": 0.6, "1-3d": 0.75, "4-7d": 0.95, "1-4w": 1.15, ">1m": 1.2 };

const CONDITIONS: ConditionDef[] = [
  {
    name: "Common cold",
    severity: "low",
    weights: {
      runny_nose: 0.7,
      nasal_congestion: 0.7,
      sneezing: 0.6,
      sore_throat: 0.5,
      cough: 0.4,
      hoarse_voice: 0.3,
      fatigue: 0.2,
      fever: [0.1, "A mild fever can accompany a cold, though adults often have none."],
      high_fever: [-0.5, "A high fever is unusual for a simple cold and suggests something more systemic."],
      itchy_eyes: -0.1,
    },
    duration: { "<24h": 0.9, "1-3d": 1.1, "4-7d": 1.1, "1-4w": 0.7, ">1m": 0.3 },
    followUps: [
      { question: "Did your symptoms start gradually over a day or two?", why_it_matters: "Colds usually creep in gradually, whereas flu tends to hit suddenly.", yes: 0.1, no: -0.1 },
      { question: "Is anyone around you sick with similar symptoms?", why_it_matters: "Close contacts with the same symptoms point toward a contagious viral cause.", yes: 0.06, no: -0.03 },
    ],
  },
  {
    name: "Influenza",
    severity: "moderate",
    weights: {
      fever: 0.7,
      high_fever: 0.8,
      chills: 0.6,
      muscle_aches: [0.7, "Widespread body aches are one of the most characteristic flu symptoms."],
      fatigue: 0.6,
      headache: 0.5,
      cough: 0.5,
      sore_throat: 0.3,
      runny_nose: 0.2,
      sneezing: -0.2,
    },
    duration: SHORT,
    demographics: (age) => (age >= 65 ? { factor: 1.1, note: "Age 65+ raises the likelihood and risk of influenza complications." } : null),
    followUps: [
      { question: "Did your symptoms come on suddenly, within a few hours?", why_it_matters: "An abrupt onset of fever and aches is typical of influenza.", yes: 0.12, no: -0.1 },
      { question: "Have you had a flu vaccine this season?", why_it_matters: "Vaccination lowers the chance that this is influenza.", yes: -0.08, no: 0.04 },
    ],
  },
  {
    name: "COVID-19",
    severity: "moderate",
    weights: {
      loss_of_smell: [0.9, "Sudden loss of smell or taste is a distinctive feature of COVID-19."],
      fever: 0.5,
      cough: 0.6,
      fatigue: 0.5,
      shortness_of_breath: 0.5,
      sore_throat: 0.3,
      headache: 0.3,
      muscle_aches: 0.3,
      diarrhea: 0.2,
      sneezing: -0.2,
      itchy_eyes: -0.2,
    },
    duration: SHORT,
    followUps: [
      { question: "Have you tested positive for COVID-19 or been exposed recently?", why_it_matters: "A positive test or known exposure strongly changes the probability.", yes: 0.2, no: -0.08 },
    ],
  },
  {
    name: "Strep throat",
    severity: "moderate",
    weights: {
      sore_throat: [0.9, "A sudden, severe sore throat is the core feature of strep."],
      swollen_glands: 0.7,
      fever: 0.5,
      high_fever: 0.3,
      headache: 0.2,
      cough: [-0.5, "Cough points toward a viral infection rather than strep."],
      runny_nose: [-0.4, "A runny nose is more typical of viral colds than strep."],
      hoarse_voice: -0.3,
    },
    duration: SHORT,
    followUps: [
      { question: "Do you see white patches or spots on your tonsils?", why_it_matters: "Tonsil exudate is one of the clinical criteria used to judge the likelihood of strep.", yes: 0.15, no: -0.08 },
    ],
  },
  {
    name: "Seasonal allergies",
    severity: "low",
    weights: {
      itchy_eyes: [0.9, "Itchy, watery eyes are a classic allergy sign and uncommon in infections."],
      sneezing: 0.8,
      runny_nose: 0.6,
      nasal_congestion: 0.5,
      itching: 0.3,
      fever: [-0.7, "Allergies do not cause fever, so fever argues for an infection."],
      high_fever: -0.8,
      muscle_aches: -0.4,
    },
    duration: LONG,
    followUps: [
      { question: "Do your symptoms get worse outdoors or around pets or dust?", why_it_matters: "A clear trigger pattern is the strongest pointer toward allergies.", yes: 0.15, no: -0.08 },
    ],
  },
  {
    name: "Migraine",
    severity: "moderate",
    weights: {
      headache: 0.9,
      light_sensitivity: [0.8, "Sensitivity to light during a headache is a hallmark of migraine."],
      nausea: 0.5,
      blurred_vision: 0.4,
      dizziness: 0.3,
      vomiting: 0.2,
      fever: [-0.6, "Fever is not part of migraine and suggests an infectious cause."],
      stiff_neck: -0.3,
    },
    duration: { "<24h": 1.15, "1-3d": 1.05, "4-7d": 0.7, "1-4w": 0.5, ">1m": 0.6 },
    followUps: [
      { question: "Have you had similar headaches before?", why_it_matters: "Migraines are usually recurrent; a first-ever severe headache needs more caution.", yes: 0.12, no: -0.08 },
      { question: "Is the headache on one side and throbbing?", why_it_matters: "One-sided, pulsating pain is typical of migraine.", yes: 0.1, no: -0.05 },
    ],
  },
  {
    name: "Gastroenteritis",
    severity: "moderate",
    weights: {
      diarrhea: 0.9,
      vomiting: 0.7,
      nausea: 0.7,
      abdominal_pain: 0.6,
      fever: 0.3,
      loss_of_appetite: 0.3,
      bloating: 0.2,
      chills: 0.2,
      lower_right_abdominal_pain: [-0.3, "Pain localised to the lower right is less typical of gastroenteritis, which usually causes diffuse cramping."],
    },
    duration: SHORT,
    followUps: [
      { question: "Did anyone who ate the same food get sick too?", why_it_matters: "Shared illness after a meal points to food-borne gastroenteritis.", yes: 0.12, no: -0.03 },
      { question: "Are you able to keep fluids down?", why_it_matters: "Inability to keep fluids down raises the risk of dehydration.", yes: 0.02, no: 0.02 },
    ],
  },
  {
    name: "Appendicitis",
    key: ["lower_right_abdominal_pain"],
    severity: "emergency",
    weights: {
      lower_right_abdominal_pain: [1, "Pain in the lower-right abdomen is the classic location of appendicitis."],
      abdominal_pain: 0.5,
      loss_of_appetite: 0.5,
      nausea: 0.4,
      vomiting: 0.4,
      fever: 0.4,
      diarrhea: -0.3,
    },
    duration: { "<24h": 1.2, "1-3d": 1.1, "4-7d": 0.8, "1-4w": 0.4, ">1m": 0.1 },
    demographics: (age) => (age >= 10 && age <= 30 ? { factor: 1.1, note: "Appendicitis is most common between ages 10 and 30." } : null),
    followUps: [
      { question: "Did the pain start around the belly button and move to the lower right?", why_it_matters: "Pain that migrates this way is a classic pattern of appendicitis.", yes: 0.18, no: -0.08 },
      { question: "Does the pain get worse when you move, cough, or press and release?", why_it_matters: "Pain on movement or rebound suggests irritation of the abdominal lining.", yes: 0.12, no: -0.06 },
    ],
  },
  {
    name: "Urinary tract infection",
    key: ["painful_urination", "frequent_urination"],
    severity: "moderate",
    weights: {
      painful_urination: [0.9, "Burning or pain on urination is the most specific UTI symptom."],
      frequent_urination: 0.8,
      blood_in_urine: 0.4,
      lower_back_pain: 0.2,
      abdominal_pain: 0.2,
      fever: 0.1,
    },
    demographics: (_age, sex) =>
      sex === "female"
        ? { factor: 1.2, note: "UTIs are considerably more common in females." }
        : sex === "male"
          ? { factor: 0.75, note: "UTIs are less common in males, so the prior is lowered." }
          : null,
    followUps: [
      { question: "Do you have pain in your side or back with a fever?", why_it_matters: "Fever with flank pain can mean the infection has reached the kidneys.", yes: 0.05, no: 0 },
    ],
  },
  {
    name: "Kidney stones",
    key: ["flank_pain", "blood_in_urine"],
    severity: "high",
    weights: {
      flank_pain: [0.9, "Sharp, wave-like flank pain is the classic presentation of a kidney stone."],
      blood_in_urine: 0.7,
      lower_back_pain: 0.5,
      nausea: 0.4,
      vomiting: 0.3,
      painful_urination: 0.3,
      fever: -0.2,
    },
    followUps: [
      { question: "Does the pain come in waves and radiate toward the groin?", why_it_matters: "Colicky pain radiating to the groin is characteristic of a stone moving down the ureter.", yes: 0.18, no: -0.08 },
    ],
  },
  {
    name: "Pneumonia",
    key: ["productive_cough", "shortness_of_breath", "chest_pain"],
    severity: "high",
    weights: {
      productive_cough: [0.8, "A cough producing phlegm suggests infection in the lower airways."],
      cough: 0.5,
      shortness_of_breath: 0.7,
      high_fever: 0.6,
      fever: 0.5,
      chest_pain: 0.5,
      chills: 0.5,
      fatigue: 0.3,
      confusion: 0.3,
    },
    duration: { "<24h": 0.7, "1-3d": 1, "4-7d": 1.15, "1-4w": 1, ">1m": 0.5 },
    demographics: (age) =>
      age >= 65 || age < 5 ? { factor: 1.2, note: "Very young and older people are at higher risk of pneumonia." } : null,
    followUps: [
      { question: "Does it hurt to take a deep breath?", why_it_matters: "Pleuritic chest pain suggests inflammation near the lung lining.", yes: 0.12, no: -0.05 },
    ],
  },
  {
    name: "Meningitis",
    key: ["stiff_neck", "confusion", "rash"],
    severity: "emergency",
    weights: {
      stiff_neck: [1, "A stiff neck with fever is a warning sign of meningeal inflammation."],
      high_fever: 0.7,
      fever: 0.5,
      headache: 0.6,
      light_sensitivity: 0.5,
      confusion: 0.6,
      rash: [0.4, "A non-blanching rash with fever can indicate meningococcal infection."],
      vomiting: 0.3,
    },
    followUps: [
      { question: "Does a rash stay visible when you press a glass against it?", why_it_matters: "A rash that does not fade under pressure is a medical emergency sign.", yes: 0.25, no: -0.05 },
    ],
  },
  {
    name: "Asthma flare-up",
    key: ["wheezing"],
    severity: "moderate",
    weights: {
      wheezing: [0.9, "Wheezing reflects narrowed airways, the defining feature of asthma."],
      shortness_of_breath: 0.7,
      cough: 0.5,
      chest_pain: 0.3,
      fever: -0.4,
    },
    followUps: [
      { question: "Have you been diagnosed with asthma before?", why_it_matters: "A known asthma history makes a flare-up far more likely.", yes: 0.2, no: -0.1 },
    ],
  },
  {
    name: "Iron-deficiency anemia",
    key: ["pale_skin"],
    severity: "low",
    weights: {
      pale_skin: [0.9, "Pallor reflects reduced haemoglobin and is a key sign of anemia."],
      fatigue: 0.6,
      dizziness: 0.5,
      palpitations: 0.4,
      shortness_of_breath: 0.3,
      headache: 0.2,
    },
    duration: LONG,
    demographics: (_age, sex) =>
      sex === "female" ? { factor: 1.15, note: "Iron-deficiency anemia is more common in females of reproductive age." } : null,
    followUps: [
      { question: "Have you had heavy periods or any recent blood loss?", why_it_matters: "Ongoing blood loss is the most common cause of iron deficiency.", yes: 0.15, no: -0.05 },
    ],
  },
  {
    name: "Hepatitis",
    key: ["jaundice"],
    severity: "high",
    weights: {
      jaundice: [1, "Yellowing of the skin or eyes indicates the liver is not clearing bilirubin."],
      fatigue: 0.4,
      abdominal_pain: 0.4,
      nausea: 0.4,
      loss_of_appetite: 0.4,
      fever: 0.2,
    },
    followUps: [
      { question: "Is your urine dark or your stool pale?", why_it_matters: "Dark urine and pale stool support a liver or bile-duct problem.", yes: 0.15, no: -0.05 },
    ],
  },
];

const RED_FLAG_RULES: { when: (s: Set<string>, input: PredictInput) => boolean; text: string }[] = [
  {
    when: (s) => s.has("chest_pain") && (s.has("shortness_of_breath") || s.has("palpitations")),
    text: "Chest pain with breathlessness or palpitations needs urgent medical assessment.",
  },
  {
    when: (s) => s.has("stiff_neck") && (s.has("fever") || s.has("high_fever")),
    text: "Fever with a stiff neck can signal meningitis. Seek emergency care.",
  },
  { when: (s) => s.has("confusion"), text: "New confusion is a warning sign and should be assessed promptly." },
  {
    when: (s) => s.has("lower_right_abdominal_pain") && (s.has("fever") || s.has("vomiting")),
    text: "Lower-right abdominal pain with fever or vomiting may indicate appendicitis.",
  },
  { when: (s) => s.has("blood_in_urine"), text: "Blood in the urine should always be checked by a clinician." },
  { when: (s) => s.has("jaundice"), text: "Yellowing of the skin or eyes needs medical evaluation." },
  {
    when: (s) => s.has("shortness_of_breath") && !s.has("chest_pain"),
    text: "Difficulty breathing that is worsening or severe needs urgent care.",
  },
  {
    when: (s, i) => s.has("high_fever") && (i.age >= 65 || i.age < 3),
    text: "High fever in very young children or older adults warrants prompt medical advice.",
  },
  {
    when: (s, i) => s.has("weight_loss") && (i.duration === "1-4w" || i.duration === ">1m"),
    text: "Unexplained weight loss over weeks should be investigated by a doctor.",
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function describe(label: string, condition: string, w: number): string {
  const l = label.charAt(0).toUpperCase() + label.slice(1);
  // Lowercase the name for mid-sentence use, but keep acronyms like "COVID-19".
  condition = /^[A-Z]{2}/.test(condition) ? condition : condition.charAt(0).toLowerCase() + condition.slice(1);
  if (w >= 0.7) return `${l} is a hallmark feature of ${condition}.`;
  if (w >= 0.4) return `${l} is commonly reported with ${condition}.`;
  if (w > 0) return `${l} can occur with ${condition}, but is non-specific.`;
  return `${l} is atypical for ${condition}, which argues against it.`;
}

interface Scored {
  def: ConditionDef;
  confidence: number;
  evidence: number;
  contributions: Contribution[];
  notes: string[];
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason ?? new Error("Aborted"));
    });
  });
}

export class MockPredictor implements Predictor {
  readonly source = "mock" as const;

  constructor(private readonly delayMs = 650) {}

  async predict(input: PredictInput, options?: { signal?: AbortSignal }): Promise<PredictionResult> {
    if (this.delayMs > 0) await sleep(this.delayMs, options?.signal);
    return mockPredict(input);
  }
}

export function mockPredict(input: PredictInput): PredictionResult {
  // Resolve symptoms to catalog ids, keeping the user's original text for output.
  const known: { id: string; text: string; region: Region }[] = [];
  const unknown: string[] = [];
  for (const text of input.symptoms) {
    const s = findSymptom(text);
    if (s && !known.some((k) => k.id === s.id)) known.push({ id: s.id, text, region: s.region });
    else if (!s) unknown.push(text);
  }
  const present = new Set(known.map((k) => k.id));
  const allAnswers = input.answers ?? [];
  // Symptom details ("Symptom detail: <label>") are logged by the user, not replies to our questions.
  const details = parseDetailAnswers(allAnswers);
  const answers = allAnswers.filter((a) => !isDetailAnswer(a));
  const SEVERITY_FACTOR = { mild: 0.75, moderate: 1, severe: 1.25 } as const;

  const scored: Scored[] = CONDITIONS.map((def) => {
    const entries = Object.entries(def.weights).map(([id, w]) => {
      const [weight, reason] = Array.isArray(w) ? w : [w, undefined];
      return { id, weight, reason };
    });
    const maxPositive = entries.reduce((a, e) => a + Math.max(0, e.weight), 0);

    const contributions: Contribution[] = [];
    let evidence = 0;
    let onsetFit = 1;
    // Conditions that typically start abruptly (they favour the shortest durations).
    const acuteCondition = (def.duration?.["<24h"] ?? 1) >= 0.9;
    for (const k of known) {
      const e = entries.find((x) => x.id === k.id);
      if (!e) continue;
      const d = details.get(k.text.toLowerCase());
      // A logged severity scales how strongly a supporting symptom counts.
      const factor = d?.severity && e.weight > 0 ? SEVERITY_FACTOR[d.severity] : 1;
      const weight = Math.max(-1, Math.min(1, round2(e.weight * factor)));
      evidence += weight;
      if (d?.onset && e.weight > 0) onsetFit *= (d.onset === "sudden") === acuteCondition ? 1.06 : 0.94;
      const base = e.reason ?? describe(k.text, def.name, e.weight);
      contributions.push({
        symptom: k.text,
        weight,
        reason: factor !== 1 ? `${base} Weighted ${factor > 1 ? "up" : "down"} because you rated it ${d!.severity}.` : base,
      });
    }

    // Coverage of the typical presentation → saturating confidence curve.
    const coverage = Math.max(0, evidence) / (maxPositive * 0.55);
    let confidence = 0.92 * (1 - Math.exp(-1.3 * coverage));

    const notes: string[] = [];
    if (def.key && !def.key.some((id) => present.has(id))) confidence *= 0.35;
    const durationFactor = def.duration?.[input.duration] ?? 1;
    confidence *= durationFactor * onsetFit;
    const demo = def.demographics?.(input.age, input.sex);
    if (demo) {
      confidence *= demo.factor;
      notes.push(demo.note);
    }

    for (const a of answers) {
      const f = def.followUps.find((q) => q.question === a.question);
      if (!f) continue;
      const yes = /^(y|yes|true)\b/i.test(a.answer);
      const no = /^(n|no|false)\b/i.test(a.answer);
      if (yes) confidence += f.yes;
      else if (no) confidence += f.no;
    }

    contributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    return { def, confidence: round2(clamp(confidence, 0.01, 0.95)), evidence, contributions, notes };
  });

  const ranked = scored
    .filter((s) => s.evidence > 0 && s.contributions.some((c) => c.weight > 0))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);

  const predictions: Prediction[] = ranked.map((s) => ({
    condition: s.def.name,
    confidence: s.confidence,
    severity: s.def.severity,
    contributions: s.contributions,
  }));

  if (predictions.length === 0) {
    predictions.push({
      condition: "Non-specific illness",
      confidence: 0.2,
      severity: "low",
      contributions: input.symptoms.map((symptom) => ({
        symptom,
        weight: 0.1,
        reason: `${symptom} does not strongly match any condition in the reference set.`,
      })),
    });
  }

  // ---------- Red flags ----------
  const red_flags = RED_FLAG_RULES.filter((r) => r.when(present, input)).map((r) => r.text);

  // ---------- Reasoning ----------
  const regions = [...new Set(known.map((k) => REGION_LABELS[k.region].toLowerCase()))];
  const reasoning_steps: string[] = [];
  reasoning_steps.push(
    `Parsed ${input.symptoms.length} symptom${input.symptoms.length === 1 ? "" : "s"}` +
      (regions.length ? ` across ${regions.join(", ")}.` : ".") +
      (unknown.length ? ` ${unknown.length} (${unknown.join(", ")}) were not in the reference catalog and carry no weight.` : ""),
  );
  reasoning_steps.push(
    `Compared the symptom set against ${CONDITIONS.length} reference conditions; matching symptoms add weight and atypical ones subtract it.`,
  );

  const strongest = ranked
    .flatMap((s) => s.contributions.map((c) => ({ c, name: s.def.name })))
    .sort((a, b) => b.c.weight - a.c.weight)[0];
  if (strongest) {
    reasoning_steps.push(
      `Strongest single signal: "${strongest.c.symptom}" toward ${strongest.name} (weight +${strongest.c.weight.toFixed(2)}).`,
    );
  }

  const contra = ranked
    .flatMap((s) => s.contributions.filter((c) => c.weight < 0).map((c) => ({ c, name: s.def.name })))
    .sort((a, b) => a.c.weight - b.c.weight)[0];
  if (contra) {
    reasoning_steps.push(`Contradicting evidence: "${contra.c.symptom}" lowers ${contra.name} (${contra.c.weight.toFixed(2)}).`);
  }

  const acute = input.duration === "<24h" || input.duration === "1-3d";
  const chronic = input.duration === "1-4w" || input.duration === ">1m";
  reasoning_steps.push(
    `Duration of ${DURATION_LABELS[input.duration].toLowerCase()} ` +
      (acute
        ? "favours acute causes such as infections."
        : chronic
          ? "favours longer-running conditions and makes short viral illnesses less likely."
          : "is consistent with both acute and evolving conditions."),
  );

  const demoNotes = [...new Set(ranked.flatMap((s) => s.notes))];
  reasoning_steps.push(
    demoNotes.length
      ? `Adjusted for age ${input.age} and sex (${input.sex}): ${demoNotes.join(" ")}`
      : `Age ${input.age} and sex (${input.sex}) did not materially change the ranking.`,
  );

  if (details.size) {
    reasoning_steps.push(
      `Weighed the extra detail you logged for ${details.size} symptom${details.size === 1 ? "" : "s"}: severity scales each symptom's weight, and a sudden or gradual onset favours acute or slower conditions.`,
    );
  }
  if (answers.length) {
    reasoning_steps.push(
      `Incorporated ${answers.length} follow-up answer${answers.length === 1 ? "" : "s"} to refine the confidence of the related conditions.`,
    );
  }

  const [first, second] = predictions;
  reasoning_steps.push(
    second
      ? `Top result: ${first.condition} at ${Math.round(first.confidence * 100)}%, ${Math.round((first.confidence - second.confidence) * 100)} points ahead of ${second.condition}.`
      : `Top result: ${first.condition} at ${Math.round(first.confidence * 100)}%.`,
  );
  if (red_flags.length) {
    reasoning_steps.push("Red-flag symptoms were detected; these warrant medical attention regardless of the ranking.");
  }

  // ---------- Follow-up questions (skip already-answered ones) ----------
  const answered = new Set(answers.map((a) => a.question));
  const follow_up_questions: FollowUpQuestion[] = [];
  for (const s of ranked.slice(0, 3)) {
    for (const f of s.def.followUps) {
      if (answered.has(f.question) || follow_up_questions.some((q) => q.question === f.question)) continue;
      follow_up_questions.push({ question: f.question, why_it_matters: f.why_it_matters });
      if (follow_up_questions.length >= 4) break;
    }
    if (follow_up_questions.length >= 4) break;
  }

  return { predictions, reasoning_steps, red_flags, follow_up_questions };
}
