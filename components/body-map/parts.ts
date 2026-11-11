import { findSymptom } from "@/lib/symptoms";
import type { SymptomDetail } from "@/lib/symptomDetail";
import { SURFACE_SLOTS, type SurfaceSlot, type Vec3 } from "./bodyModel";

/**
 * What lights up for each symptom: internal organs (drawn inside the translucent
 * body) and surface areas. Sided parts let "left" / "right" details light one side.
 */
export const ORGAN_IDS = [
  "brain", "eyeL", "eyeR", "sinus", "earL", "earR", "throat", "neckNodes",
  "lungL", "lungR", "heart", "liver", "stomach", "intestines", "appendix",
  "kidneyL", "kidneyR", "bladder", "lowerBack", "jointsL", "jointsR",
] as const;
export type OrganId = (typeof ORGAN_IDS)[number];
export type PartId = OrganId | SurfaceSlot | "skin";
/** 0–1 glow per part. */
export type PartGlow = Partial<Record<PartId, number>>;

export type OrganShape =
  | { kind: "ellipsoid"; c: Vec3; r: Vec3; tilt?: number }
  | { kind: "tube"; path: Vec3[]; radius: number }
  | { kind: "spheres"; centers: Vec3[]; radius: number };

export interface Organ {
  id: OrganId;
  label: string;
  shape: OrganShape;
  /** "always": faintly visible at rest (anatomy). "lit": only appears when it glows. */
  show: "always" | "lit";
}

const L = (x: number) => x; // body's left is +x
const R = (x: number) => -x;

const JOINTS = (side: (x: number) => number): Vec3[] => [
  [side(0.122), 0.2, 0], // shoulder
  [side(0.164), 0.371, -0.006], // elbow
  [side(0.196), 0.48, 0.004], // wrist
  [side(0.072), 0.49, 0.004], // hip
  [side(0.062), 0.73, 0.014], // knee
  [side(0.064), 0.95, -0.006], // ankle
];

// Serpentine path through the abdomen for the small intestine.
const GUT: Vec3[] = [];
for (let row = 0; row < 5; row++) {
  const y = 0.362 + row * 0.019;
  const xs = row % 2 ? [0.052, -0.052] : [-0.052, 0.052];
  GUT.push([xs[0], y, 0.018], [0, y + 0.004, 0.026], [xs[1], y + 0.008, 0.018]);
}

export const ORGANS: Organ[] = [
  { id: "brain", label: "Brain", show: "always", shape: { kind: "ellipsoid", c: [0, 0.05, -0.008], r: [0.036, 0.03, 0.044] } },
  { id: "eyeL", label: "Left eye", show: "always", shape: { kind: "ellipsoid", c: [L(0.016), 0.075, 0.042], r: [0.008, 0.0055, 0.006] } },
  { id: "eyeR", label: "Right eye", show: "always", shape: { kind: "ellipsoid", c: [R(0.016), 0.075, 0.042], r: [0.008, 0.0055, 0.006] } },
  { id: "sinus", label: "Nose & sinuses", show: "lit", shape: { kind: "ellipsoid", c: [0, 0.082, 0.04], r: [0.016, 0.017, 0.012] } },
  { id: "earL", label: "Left ear", show: "lit", shape: { kind: "ellipsoid", c: [L(0.042), 0.077, -0.004], r: [0.008, 0.012, 0.009] } },
  { id: "earR", label: "Right ear", show: "lit", shape: { kind: "ellipsoid", c: [R(0.042), 0.077, -0.004], r: [0.008, 0.012, 0.009] } },
  { id: "throat", label: "Throat & windpipe", show: "always", shape: { kind: "tube", path: [[0, 0.1, 0.012], [0, 0.14, 0.014], [0, 0.18, 0.012], [0, 0.205, 0.006]], radius: 0.0075 } },
  { id: "neckNodes", label: "Neck lymph nodes", show: "lit", shape: { kind: "spheres", centers: [[L(0.024), 0.122, 0.012], [R(0.024), 0.122, 0.012], [L(0.028), 0.137, 0.002], [R(0.028), 0.137, 0.002]], radius: 0.0055 } },
  { id: "lungL", label: "Left lung", show: "always", shape: { kind: "ellipsoid", c: [L(0.045), 0.246, -0.002], r: [0.034, 0.06, 0.04], tilt: -0.08 } },
  { id: "lungR", label: "Right lung", show: "always", shape: { kind: "ellipsoid", c: [R(0.045), 0.246, -0.002], r: [0.036, 0.06, 0.04], tilt: 0.08 } },
  { id: "heart", label: "Heart", show: "always", shape: { kind: "ellipsoid", c: [L(0.014), 0.262, 0.024], r: [0.025, 0.029, 0.022], tilt: 0.45 } },
  { id: "liver", label: "Liver", show: "always", shape: { kind: "ellipsoid", c: [R(0.03), 0.314, 0.014], r: [0.05, 0.025, 0.035], tilt: -0.22 } },
  { id: "stomach", label: "Stomach", show: "always", shape: { kind: "ellipsoid", c: [L(0.032), 0.322, 0.022], r: [0.03, 0.022, 0.021], tilt: 0.5 } },
  { id: "intestines", label: "Intestines", show: "always", shape: { kind: "tube", path: GUT, radius: 0.0085 } },
  { id: "appendix", label: "Appendix (lower right)", show: "lit", shape: { kind: "ellipsoid", c: [R(0.05), 0.438, 0.022], r: [0.008, 0.014, 0.008], tilt: 0.3 } },
  { id: "kidneyL", label: "Left kidney", show: "always", shape: { kind: "ellipsoid", c: [L(0.042), 0.352, -0.032], r: [0.014, 0.024, 0.013], tilt: -0.2 } },
  { id: "kidneyR", label: "Right kidney", show: "always", shape: { kind: "ellipsoid", c: [R(0.042), 0.358, -0.032], r: [0.014, 0.024, 0.013], tilt: 0.2 } },
  { id: "bladder", label: "Bladder", show: "always", shape: { kind: "ellipsoid", c: [0, 0.468, 0.024], r: [0.021, 0.017, 0.017] } },
  { id: "lowerBack", label: "Lower back", show: "lit", shape: { kind: "ellipsoid", c: [0, 0.415, -0.044], r: [0.05, 0.045, 0.012] } },
  { id: "jointsL", label: "Left-side joints", show: "lit", shape: { kind: "spheres", centers: JOINTS(L), radius: 0.013 } },
  { id: "jointsR", label: "Right-side joints", show: "lit", shape: { kind: "spheres", centers: JOINTS(R), radius: 0.013 } },
];

// ---------- symptom → parts ----------

/** Paired structures expand to both sides unless a side is given. */
const SIDED = {
  lungs: ["lungL", "lungR"],
  kidneys: ["kidneyL", "kidneyR"],
  eyes: ["eyeL", "eyeR"],
  ears: ["earL", "earR"],
  arms: ["armL", "armR"],
  legs: ["legL", "legR"],
  joints: ["jointsL", "jointsR"],
} as const satisfies Record<string, readonly [PartId, PartId]>;
type Group = PartId | keyof typeof SIDED;

const SYMPTOM_PARTS: Record<string, Group[]> = {
  headache: ["brain", "head"],
  dizziness: ["brain", "ears"],
  light_sensitivity: ["eyes", "brain"],
  blurred_vision: ["eyes"],
  ear_pain: ["ears"],
  nasal_congestion: ["sinus"],
  runny_nose: ["sinus"],
  sneezing: ["sinus"],
  itchy_eyes: ["eyes"],
  loss_of_smell: ["sinus"],
  sore_throat: ["throat"],
  stiff_neck: ["neck"],
  swollen_glands: ["neckNodes"],
  hoarse_voice: ["throat"],
  cough: ["lungs", "throat"],
  productive_cough: ["lungs", "throat"],
  shortness_of_breath: ["lungs"],
  chest_pain: ["heart", "chest"],
  wheezing: ["lungs"],
  palpitations: ["heart"],
  nausea: ["stomach"],
  vomiting: ["stomach"],
  diarrhea: ["intestines"],
  abdominal_pain: ["intestines", "abdomen"],
  lower_right_abdominal_pain: ["appendix"],
  loss_of_appetite: ["stomach"],
  bloating: ["intestines", "stomach"],
  painful_urination: ["bladder"],
  frequent_urination: ["bladder"],
  blood_in_urine: ["bladder", "kidneys"],
  lower_back_pain: ["lowerBack"],
  flank_pain: ["kidneys"],
  muscle_aches: ["arms", "legs"],
  joint_pain: ["joints"],
  leg_swelling: ["legs"],
  numbness: ["arms", "legs"],
  rash: ["skin"],
  itching: ["skin"],
  pale_skin: ["skin"],
  jaundice: ["skin", "liver", "eyes"],
  fever: ["skin"],
  high_fever: ["skin", "brain"],
  chills: ["skin"],
  fatigue: ["skin"],
  night_sweats: ["skin"],
  weight_loss: ["skin"],
  confusion: ["brain"],
};

const SEVERITY_GLOW = { mild: 0.55, moderate: 0.8, severe: 1 } as const;

function groupsFor(label: string): Group[] {
  const s = findSymptom(label);
  return (s && SYMPTOM_PARTS[s.id]) ?? [];
}

/** True when the symptom involves paired structures, so a left/right detail is meaningful. */
export function symptomHasSides(label: string): boolean {
  return groupsFor(label).some((g) => g in SIDED);
}

/** The parts a symptom lights, honouring a left/right detail for paired structures. */
export function partsForSymptom(label: string, side?: SymptomDetail["side"]): PartId[] {
  return groupsFor(label).flatMap((g): PartId[] => {
    if (!(g in SIDED)) return [g as PartId];
    const [left, right] = SIDED[g as keyof typeof SIDED];
    return side === "left" ? [left] : side === "right" ? [right] : [left, right];
  });
}

/**
 * Glow per part for the given symptoms: stronger for more severe symptoms,
 * full strength for the ones in `focus` (hovered chip, selected reasoning step).
 */
export function glowForSymptoms(symptoms: string[], details: Record<string, SymptomDetail>, focus: string[] = []): PartGlow {
  const glow: PartGlow = {};
  for (const label of symptoms) {
    const d = details[label];
    const level = focus.includes(label) ? 1 : d?.severity ? SEVERITY_GLOW[d.severity] : 0.75;
    for (const p of partsForSymptom(label, d?.side)) glow[p] = Math.max(glow[p] ?? 0, level);
  }
  return glow;
}

/** Surface glow per slot, folding "skin" (whole surface) in. */
export function surfaceLevels(glow: PartGlow): number[] {
  const skin = glow.skin ?? 0;
  return SURFACE_SLOTS.map((s) => Math.max(glow[s] ?? 0, skin * 0.7));
}

const SURFACE_LABELS: Record<SurfaceSlot | "skin", string> = {
  head: "Head",
  neck: "Neck",
  chest: "Chest wall",
  abdomen: "Abdomen",
  pelvis: "Pelvis",
  armL: "Left arm",
  armR: "Right arm",
  legL: "Left leg",
  legR: "Right leg",
  skin: "Skin (whole body)",
};

/** Human-readable name of a part, e.g. "Left lung". */
export function partLabel(id: PartId): string {
  return ORGANS.find((o) => o.id === id)?.label ?? SURFACE_LABELS[id as SurfaceSlot | "skin"] ?? id;
}
