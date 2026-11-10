/**
 * Symptom catalog grouped by body region.
 * Shared by the UI (pickers / body map) and the mock predictor.
 * The `label` is what gets sent to the API and echoed back in contributions.
 */

export const REGIONS = [
  "head",
  "throat",
  "chest",
  "abdomen",
  "pelvis",
  "limbs",
  "skin",
  "general",
] as const;

export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  head: "Head & face",
  throat: "Throat & neck",
  chest: "Chest",
  abdomen: "Abdomen",
  pelvis: "Pelvis & lower back",
  limbs: "Arms & legs",
  skin: "Skin",
  general: "Whole body",
};

export interface Symptom {
  id: string;
  label: string;
  region: Region;
}

const RAW: Record<Region, Array<[string, string]>> = {
  head: [
    ["headache", "Headache"],
    ["dizziness", "Dizziness"],
    ["light_sensitivity", "Sensitivity to light"],
    ["blurred_vision", "Blurred vision"],
    ["ear_pain", "Ear pain"],
    ["nasal_congestion", "Nasal congestion"],
    ["runny_nose", "Runny nose"],
    ["sneezing", "Sneezing"],
    ["itchy_eyes", "Itchy, watery eyes"],
    ["loss_of_smell", "Loss of smell or taste"],
  ],
  throat: [
    ["sore_throat", "Sore throat"],
    ["stiff_neck", "Stiff neck"],
    ["swollen_glands", "Swollen neck glands"],
    ["hoarse_voice", "Hoarse voice"],
  ],
  chest: [
    ["cough", "Cough"],
    ["productive_cough", "Cough with phlegm"],
    ["shortness_of_breath", "Shortness of breath"],
    ["chest_pain", "Chest pain"],
    ["wheezing", "Wheezing"],
    ["palpitations", "Palpitations"],
  ],
  abdomen: [
    ["nausea", "Nausea"],
    ["vomiting", "Vomiting"],
    ["diarrhea", "Diarrhea"],
    ["abdominal_pain", "Abdominal pain"],
    ["lower_right_abdominal_pain", "Lower-right abdominal pain"],
    ["loss_of_appetite", "Loss of appetite"],
    ["bloating", "Bloating"],
  ],
  pelvis: [
    ["painful_urination", "Painful urination"],
    ["frequent_urination", "Frequent urination"],
    ["blood_in_urine", "Blood in urine"],
    ["lower_back_pain", "Lower back pain"],
    ["flank_pain", "Flank (side) pain"],
  ],
  limbs: [
    ["muscle_aches", "Muscle aches"],
    ["joint_pain", "Joint pain"],
    ["leg_swelling", "Leg swelling"],
    ["numbness", "Numbness or tingling"],
  ],
  skin: [
    ["rash", "Rash"],
    ["itching", "Itching"],
    ["pale_skin", "Pale skin"],
    ["jaundice", "Yellowing of skin or eyes"],
  ],
  general: [
    ["fever", "Fever"],
    ["high_fever", "High fever (over 39°C / 102°F)"],
    ["chills", "Chills"],
    ["fatigue", "Fatigue"],
    ["night_sweats", "Night sweats"],
    ["weight_loss", "Unexplained weight loss"],
    ["confusion", "Confusion"],
  ],
};

export const SYMPTOMS: Symptom[] = REGIONS.flatMap((region) =>
  RAW[region].map(([id, label]) => ({ id, label, region })),
);

const byId = new Map(SYMPTOMS.map((s) => [s.id, s]));
const byLabel = new Map(SYMPTOMS.map((s) => [s.label.toLowerCase(), s]));

export function symptomsInRegion(region: Region): Symptom[] {
  return SYMPTOMS.filter((s) => s.region === region);
}

/** Resolve a free-text symptom (label or id) to a catalog entry, if known. */
export function findSymptom(text: string): Symptom | undefined {
  const t = text.trim().toLowerCase();
  return byLabel.get(t) ?? byId.get(t.replace(/[\s-]+/g, "_"));
}
