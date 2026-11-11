import type { SpatialRegion } from "./types";

/**
 * Anatomical body, described once as soft primitives (muscle groups and the
 * outer shape of the skeleton) and shared by the 3D figure (blended into one
 * smooth surface) and the 2D fallback, so both agree on where everything is.
 *
 * Model space: x ∈ [-0.35, 0.35] (the body's left is +x, facing the viewer),
 * y ∈ [0, 1] from the top of the head to the soles, z = depth (+ toward the viewer).
 * Proportions follow the classic 8-heads-tall figure.
 */
export type Vec3 = [number, number, number];

/** Surface areas that can glow independently (sided limbs so "left knee" lights only the left leg). */
export const SURFACE_SLOTS = ["head", "neck", "chest", "abdomen", "pelvis", "armL", "armR", "legL", "legR"] as const;
export type SurfaceSlot = (typeof SURFACE_SLOTS)[number];

type Part = "head" | "neck" | "chest" | "abdomen" | "pelvis" | "arm" | "leg";

export type Shape =
  | { t: "e"; c: Vec3; r: Vec3; region: SpatialRegion; part: Part; k?: number } // ellipsoid
  | { t: "cap"; a: Vec3; b: Vec3; ra: number; rb: number; region: SpatialRegion; part: Part; k?: number }; // tapered capsule

const e = (c: Vec3, r: Vec3, region: SpatialRegion, part: Part, k?: number): Shape => ({ t: "e", c, r, region, part, k });
const cap = (a: Vec3, b: Vec3, ra: number, rb: number, region: SpatialRegion, part: Part, k?: number): Shape => ({ t: "cap", a, b, ra, rb, region, part, k });

/** A shape on the body's left plus its mirror on the right. */
const pair = (s: Shape): Shape[] =>
  s.t === "e"
    ? [s, { ...s, c: [-s.c[0], s.c[1], s.c[2]] }]
    : [s, { ...s, a: [-s.a[0], s.a[1], s.a[2]], b: [-s.b[0], s.b[1], s.b[2]] }];

export const SHAPES: Shape[] = [
  // ---- head ----
  e([0, 0.056, -0.006], [0.043, 0.054, 0.052], "head", "head"), // cranium
  e([0, 0.084, 0.014], [0.036, 0.042, 0.038], "head", "head"), // face
  e([0, 0.108, 0.02], [0.027, 0.019, 0.026], "head", "head", 0.02), // chin & jaw
  e([0, 0.083, 0.05], [0.0065, 0.014, 0.01], "head", "head", 0.012), // nose
  ...pair(e([0.044, 0.077, -0.004], [0.0055, 0.013, 0.009], "head", "head", 0.01)), // ears
  // ---- neck & shoulders ----
  cap([0, 0.105, -0.006], [0, 0.17, -0.004], 0.022, 0.026, "throat", "neck", 0.03),
  ...pair(cap([0.02, 0.148, -0.012], [0.098, 0.184, -0.01], 0.021, 0.017, "throat", "neck", 0.03)), // trapezius
  // ---- torso ----
  e([0, 0.245, -0.002], [0.09, 0.082, 0.056], "chest", "chest", 0.04), // rib cage
  ...pair(e([0.044, 0.232, 0.036], [0.048, 0.033, 0.026], "chest", "chest", 0.03)), // pectorals
  e([0, 0.24, -0.024], [0.094, 0.064, 0.04], "chest", "chest", 0.035), // lats / upper back
  e([0, 0.338, 0.002], [0.075, 0.07, 0.05], "abdomen", "abdomen", 0.045), // abdomen
  e([0, 0.408, 0.006], [0.08, 0.05, 0.052], "abdomen", "abdomen", 0.04), // lower abdomen
  e([0, 0.462, -0.002], [0.094, 0.052, 0.058], "pelvis", "pelvis", 0.04), // pelvis
  ...pair(e([0.046, 0.48, -0.03], [0.048, 0.05, 0.038], "pelvis", "pelvis", 0.03)), // glutes
  // ---- arms, held slightly away from the body (deltoid, upper arm, biceps, forearm, hand) ----
  ...pair(e([0.12, 0.198, 0], [0.032, 0.038, 0.034], "limbs", "arm", 0.028)),
  ...pair(cap([0.13, 0.21, -0.002], [0.163, 0.368, -0.008], 0.028, 0.02, "limbs", "arm", 0.02)),
  ...pair(e([0.143, 0.272, 0.012], [0.02, 0.045, 0.02], "limbs", "arm", 0.018)),
  ...pair(cap([0.164, 0.374, -0.006], [0.196, 0.478, 0.002], 0.022, 0.015, "limbs", "arm", 0.018)),
  ...pair(e([0.172, 0.408, -0.002], [0.022, 0.04, 0.021], "limbs", "arm", 0.018)),
  ...pair(e([0.204, 0.508, 0.006], [0.0105, 0.03, 0.021], "limbs", "arm", 0.012)), // palm
  ...pair(cap([0.207, 0.525, 0.008], [0.211, 0.564, 0.012], 0.0092, 0.0062, "limbs", "arm", 0.01)), // fingers
  ...pair(cap([0.198, 0.496, 0.025], [0.203, 0.528, 0.031], 0.006, 0.0048, "limbs", "arm", 0.008)), // thumb
  // ---- legs (thigh, quadriceps, knee, shin, calf, heel, foot) ----
  ...pair(cap([0.058, 0.488, 0.002], [0.062, 0.72, 0.006], 0.05, 0.032, "limbs", "leg", 0.02)),
  ...pair(e([0.064, 0.58, 0.017], [0.044, 0.1, 0.04], "limbs", "leg", 0.02)),
  ...pair(e([0.062, 0.73, 0.012], [0.027, 0.025, 0.028], "limbs", "leg", 0.018)),
  ...pair(cap([0.062, 0.742, 0.004], [0.064, 0.945, -0.004], 0.027, 0.017, "limbs", "leg", 0.018)),
  ...pair(e([0.065, 0.8, -0.016], [0.029, 0.068, 0.03], "limbs", "leg", 0.018)),
  ...pair(e([0.065, 0.974, -0.01], [0.018, 0.021, 0.022], "limbs", "leg", 0.014)),
  ...pair(cap([0.066, 0.978, -0.004], [0.072, 0.988, 0.07], 0.018, 0.013, "limbs", "leg", 0.014)),
];

export const REGION_INDEX: SpatialRegion[] = ["head", "throat", "chest", "abdomen", "pelvis", "limbs"];

const slotOf = (s: Shape): number => {
  const x = s.t === "e" ? s.c[0] : (s.a[0] + s.b[0]) / 2;
  const left = x > 0; // the body's left
  if (s.part === "arm") return SURFACE_SLOTS.indexOf(left ? "armL" : "armR");
  if (s.part === "leg") return SURFACE_SLOTS.indexOf(left ? "legL" : "legR");
  return SURFACE_SLOTS.indexOf(s.part);
};

// Precomputed per-shape data: bounds (for fast culling), slot, region index, blend radius.
const PAD = 0.05;
const INFO = SHAPES.map((s) => {
  const reach = s.t === "e" ? s.r : ([0, 0, 0].map(() => Math.max(s.ra, s.rb)) as Vec3);
  const lo = [0, 1, 2].map((i) => (s.t === "e" ? s.c[i] : Math.min(s.a[i], s.b[i])) - reach[i] - PAD);
  const hi = [0, 1, 2].map((i) => (s.t === "e" ? s.c[i] : Math.max(s.a[i], s.b[i])) + reach[i] + PAD);
  return { s, lo, hi, slot: slotOf(s), region: REGION_INDEX.indexOf(s.region), k: s.k ?? 0.035 };
});

/** Signed distance from a model-space point to one shape (negative inside). */
export function shapeDistance(s: Shape, x: number, y: number, z: number): number {
  if (s.t === "e") {
    const px = (x - s.c[0]) / s.r[0];
    const py = (y - s.c[1]) / s.r[1];
    const pz = (z - s.c[2]) / s.r[2];
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const qx = px / s.r[0];
    const qy = py / s.r[1];
    const qz = pz / s.r[2];
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    return k1 === 0 ? -Math.min(...s.r) : (k0 * (k0 - 1)) / k1;
  }
  const vx = s.b[0] - s.a[0];
  const vy = s.b[1] - s.a[1];
  const vz = s.b[2] - s.a[2];
  const u = Math.max(0, Math.min(1, ((x - s.a[0]) * vx + (y - s.a[1]) * vy + (z - s.a[2]) * vz) / (vx * vx + vy * vy + vz * vz)));
  const dx = s.a[0] + u * vx - x;
  const dy = s.a[1] + u * vy - y;
  const dz = s.a[2] + u * vz - z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (s.ra + (s.rb - s.ra) * u);
}

/** Polynomial smooth minimum: melts neighbouring parts into one continuous surface. */
function smin(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const inside = (it: (typeof INFO)[number], x: number, y: number, z: number) =>
  x >= it.lo[0] && x <= it.hi[0] && y >= it.lo[1] && y <= it.hi[1] && z >= it.lo[2] && z <= it.hi[2];

/** Distance to the whole body (negative inside); far from every part returns `far`. */
export function bodyDistance(x: number, y: number, z: number, far = 0.1): number {
  let d = Infinity;
  for (const it of INFO) {
    if (!inside(it, x, y, z)) continue;
    const ds = shapeDistance(it.s, x, y, z);
    d = d === Infinity ? ds : smin(d, ds, it.k);
  }
  return d === Infinity ? far : d;
}

/**
 * Soft membership of a surface point in each surface slot (weights sum to 1) and
 * the region of the nearest part, so glows fade across joints instead of ending
 * in hard, jagged edges.
 */
export function surfaceInfo(x: number, y: number, z: number, softness = 0.012): { weights: number[]; region: number } {
  const near = new Array<number>(SURFACE_SLOTS.length).fill(Infinity);
  let best = Infinity;
  let region = 0;
  for (const it of INFO) {
    if (!inside(it, x, y, z)) continue;
    const ds = shapeDistance(it.s, x, y, z);
    if (ds < near[it.slot]) near[it.slot] = ds;
    if (ds < best) {
      best = ds;
      region = it.region;
    }
  }
  const lo = Math.min(...near);
  const w = near.map((d) => (d === Infinity ? 0 : Math.exp(-(d - lo) / softness)));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return { weights: w.map((v) => v / sum), region };
}
