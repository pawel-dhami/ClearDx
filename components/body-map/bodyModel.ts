import type { SpatialRegion } from "./types";

/**
 * A simple anatomical body made of primitives, shared by the 3D point cloud and
 * the 2D SVG fallback so both always agree on where each region is.
 *
 * Coordinates: x ∈ [-0.35, 0.35] (left/right), y ∈ [0, 1] (top → bottom),
 * z = depth. Each primitive has a front/back thickness used for 3D sampling.
 */
export type Shape =
  | { t: "e"; cx: number; cy: number; rx: number; ry: number; rz: number; r: SpatialRegion } // ellipse / ellipsoid
  | { t: "cap"; ax: number; ay: number; bx: number; by: number; w: number; r: SpatialRegion }; // tapered capsule

export const SHAPES: Shape[] = [
  { t: "e", cx: 0, cy: 0.068, rx: 0.058, ry: 0.068, rz: 0.062, r: "head" },
  { t: "cap", ax: 0, ay: 0.125, bx: 0, by: 0.17, w: 0.03, r: "throat" },
  { t: "e", cx: 0, cy: 0.215, rx: 0.155, ry: 0.055, rz: 0.06, r: "chest" }, // shoulders
  { t: "e", cx: 0, cy: 0.285, rx: 0.128, ry: 0.085, rz: 0.075, r: "chest" }, // rib cage
  { t: "e", cx: 0, cy: 0.39, rx: 0.104, ry: 0.07, rz: 0.068, r: "abdomen" }, // waist
  { t: "e", cx: 0, cy: 0.475, rx: 0.122, ry: 0.055, rz: 0.07, r: "pelvis" }, // hips
  // arms: upper arm, forearm, hand
  { t: "cap", ax: -0.15, ay: 0.22, bx: -0.185, by: 0.37, w: 0.036, r: "limbs" },
  { t: "cap", ax: -0.185, ay: 0.37, bx: -0.205, by: 0.5, w: 0.03, r: "limbs" },
  { t: "e", cx: -0.21, cy: 0.53, rx: 0.022, ry: 0.034, rz: 0.014, r: "limbs" },
  { t: "cap", ax: 0.15, ay: 0.22, bx: 0.185, by: 0.37, w: 0.036, r: "limbs" },
  { t: "cap", ax: 0.185, ay: 0.37, bx: 0.205, by: 0.5, w: 0.03, r: "limbs" },
  { t: "e", cx: 0.21, cy: 0.53, rx: 0.022, ry: 0.034, rz: 0.014, r: "limbs" },
  // legs: thigh, shin, foot
  { t: "cap", ax: -0.062, ay: 0.5, bx: -0.07, by: 0.73, w: 0.056, r: "limbs" },
  { t: "cap", ax: -0.07, ay: 0.73, bx: -0.074, by: 0.935, w: 0.04, r: "limbs" },
  { t: "e", cx: -0.084, cy: 0.962, rx: 0.036, ry: 0.014, rz: 0.03, r: "limbs" },
  { t: "cap", ax: 0.062, ay: 0.5, bx: 0.07, by: 0.73, w: 0.056, r: "limbs" },
  { t: "cap", ax: 0.07, ay: 0.73, bx: 0.074, by: 0.935, w: 0.04, r: "limbs" },
  { t: "e", cx: 0.084, cy: 0.962, rx: 0.036, ry: 0.014, rz: 0.03, r: "limbs" },
];

export const REGION_INDEX: SpatialRegion[] = ["head", "throat", "chest", "abdomen", "pelvis", "limbs"];

/** Returns how "deep" inside a shape (0 = outside, 1 = centre line) the point (x, y) is. */
function depthIn(s: Shape, x: number, y: number): number {
  if (s.t === "e") {
    const dx = (x - s.cx) / s.rx;
    const dy = (y - s.cy) / s.ry;
    const d = dx * dx + dy * dy;
    return d <= 1 ? Math.sqrt(1 - d) * s.rz : 0;
  }
  const vx = s.bx - s.ax;
  const vy = s.by - s.ay;
  const u = Math.max(0, Math.min(1, ((x - s.ax) * vx + (y - s.ay) * vy) / (vx * vx + vy * vy)));
  const px = s.ax + u * vx - x;
  const py = s.ay + u * vy - y;
  const w = s.w * (1 - u * 0.35);
  const d = (px * px + py * py) / (w * w);
  return d <= 1 ? Math.sqrt(1 - d) * w : 0;
}

export interface BodyCloud {
  /** xyz triplets in model space. */
  positions: Float32Array;
  /** region index (into REGION_INDEX) per point. */
  regions: Uint8Array;
  /** per-point base brightness 0..1. */
  brightness: Float32Array;
  count: number;
}

/**
 * Deterministic point cloud: points sit mostly on the front/back surface of each
 * primitive (crisp hologram silhouette) with a few inside for volume.
 */
export function generateBodyCloud(count: number, seed = 7): BodyCloud {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const positions = new Float32Array(count * 3);
  const regions = new Uint8Array(count);
  const brightness = new Float32Array(count);
  let n = 0;
  while (n < count) {
    const x = rnd() * 0.7 - 0.35;
    const y = rnd();
    for (const shape of SHAPES) {
      const depth = depthIn(shape, x, y);
      if (depth <= 0) continue;
      const shell = rnd() < 0.8 ? 0.85 + rnd() * 0.15 : rnd(); // mostly surface
      const z = (rnd() < 0.5 ? -1 : 1) * depth * shell;
      positions[n * 3] = x;
      positions[n * 3 + 1] = y;
      positions[n * 3 + 2] = z;
      regions[n] = REGION_INDEX.indexOf(shape.r);
      brightness[n] = 0.35 + rnd() * 0.65;
      n++;
      break;
    }
  }
  return { positions, regions, brightness, count };
}
