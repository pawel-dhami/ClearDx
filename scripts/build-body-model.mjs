#!/usr/bin/env node
/**
 * Converts a human body OBJ into the compact model the body map loads at runtime.
 *
 *   node scripts/build-body-model.mjs <path/to/model.obj> [objectName]
 *
 * Output: public/models/body.json (counts, offsets, landmarks) + public/models/body.bin
 *
 * The mesh is normalised to the app's body coordinates: height 1, y = 0 at the top
 * of the head and 1 at the soles, x centred (the body's left is +x), z centred on
 * the torso and pointing toward the viewer. Every vertex is labelled with a body
 * region and soft weights per surface slot (head, neck, chest, abdomen, pelvis,
 * arms, legs, left/right) so symptoms can light the right part of the body.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [, , objPath, wanted] = process.argv;
if (!objPath) {
  console.error("Usage: node scripts/build-body-model.mjs <model.obj> [objectName]");
  process.exit(1);
}

// ---------- parse ----------
const all = [];
const objects = new Map();
let current = null;
for (const line of readFileSync(objPath, "utf8").split(/\r?\n/)) {
  if (line.startsWith("o ") || line.startsWith("g ")) {
    current = line.slice(2).trim();
    if (!objects.has(current)) objects.set(current, []);
  } else if (line.startsWith("v ")) {
    all.push(line.split(/\s+/).slice(1, 4).map(Number));
  } else if (line.startsWith("f ")) {
    if (!objects.has(current)) objects.set(current, []);
    objects.get(current).push(line.split(/\s+/).slice(1).filter(Boolean).map((t) => parseInt(t.split("/")[0], 10) - 1));
  }
}
const name = wanted ?? [...objects.keys()][0];
const faces = objects.get(name);
if (!faces) throw new Error(`Object "${name}" not found. Objects: ${[...objects.keys()].join(", ")}`);

// Re-index to just this object's vertices.
const remap = new Map();
const src = [];
const local = faces.map((f) =>
  f.map((g) => {
    if (!remap.has(g)) {
      remap.set(g, src.length);
      src.push(all[g]);
    }
    return remap.get(g);
  }),
);
const n = src.length;

// ---------- normalise ----------
let ymin = Infinity;
let ymax = -Infinity;
for (const [, y] of src) {
  ymin = Math.min(ymin, y);
  ymax = Math.max(ymax, y);
}
const H = ymax - ymin;
const tOf = (y) => (ymax - y) / H;
const slice = (t0, t1) => src.filter(([, y]) => tOf(y) >= t0 && tOf(y) < t1);
const mid = (vals) => (Math.min(...vals) + Math.max(...vals)) / 2;
const cx = mid(slice(0.02, 0.1).map((p) => p[0])); // the head is centred
const cz = mid(slice(0.24, 0.3).map((p) => p[2])); // chest depth
const P = src.map(([x, y, z]) => [(x - cx) / H, tOf(y), (z - cz) / H]);

// ---------- arms: find the gap between torso and arm in horizontal slices ----------
const STEP = 0.01;
const gapAt = new Map(); // t-slice → |x| threshold between torso and arm
for (let t = 0.14; t < 0.66; t += STEP) {
  const xs = P.filter((p) => p[1] >= t && p[1] < t + STEP).map((p) => Math.abs(p[0])).sort((a, b) => a - b);
  let best = 0;
  let at = null;
  for (let i = 1; i < xs.length; i++) {
    const g = xs[i] - xs[i - 1];
    if (g > best && xs[i - 1] > 0.03) {
      best = g;
      at = (xs[i] + xs[i - 1]) / 2;
    }
  }
  if (best > 0.008) gapAt.set(Math.round(t / STEP), at);
}
const keys = [...gapAt.keys()].sort((a, b) => a - b);
const armpitKey = keys[0];
const armpitT = armpitKey * STEP;
const shoulderX = gapAt.get(armpitKey);
function armThreshold(t) {
  const k = Math.round(Math.floor(t / STEP));
  if (t < armpitT) return shoulderX; // deltoid cap above the armpit
  if (gapAt.has(k)) return gapAt.get(k);
  // between slices with a measured gap: use the nearest one
  let nearest = keys[0];
  for (const key of keys) if (Math.abs(key - k) < Math.abs(nearest - k)) nearest = key;
  return gapAt.get(nearest);
}
// Mesh adjacency (also used for the soft weights below).
const neighbours = Array.from({ length: n }, () => new Set());
const edges = new Set();
for (const f of local) {
  for (let k = 0; k < f.length; k++) {
    const a = f[k];
    const b = f[(k + 1) % f.length];
    neighbours[a].add(b);
    neighbours[b].add(a);
    edges.add(a < b ? `${a},${b}` : `${b},${a}`);
  }
}

// Arm candidates lie outside the torso/arm gap; the arm is the part of them that is
// connected (through other candidates) to the hands, so the outer thighs never count.
const candidate = P.map(([x, t]) => t > 0.15 && t < 0.66 && Math.abs(x) > armThreshold(t));
const isArm = new Array(n).fill(false);
const queue = [];
P.forEach(([x, t], i) => {
  // seeds: the forearm just above the wrist, well clear of the hips
  if (candidate[i] && t > 0.4 && t < 0.44 && Math.abs(x) > 0.13) {
    isArm[i] = true;
    queue.push(i);
  }
});
while (queue.length) {
  const i = queue.pop();
  for (const j of neighbours[i]) {
    if (!isArm[j] && candidate[j]) {
      isArm[j] = true;
      queue.push(j);
    }
  }
}

// ---------- crotch: the height where the legs become separate pieces of the mesh ----------
function legsSplitBelow(t0) {
  const inSet = (i) => !isArm[i] && P[i][1] > t0;
  const seen = new Uint8Array(n);
  let big = 0;
  for (let s = 0; s < n; s++) {
    if (seen[s] || !inSet(s)) continue;
    let size = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      size++;
      for (const j of neighbours[i]) if (!seen[j] && inSet(j)) {
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (size > 200) big++;
  }
  return big >= 2;
}
let lo = 0.35; // legs still joined
let hi = 0.7; // legs separate
for (let k = 0; k < 14; k++) {
  const m = (lo + hi) / 2;
  if (legsSplitBelow(m)) hi = m;
  else lo = m;
}
const crotchT = hi;

// ---------- slots ----------
const SLOTS = ["head", "neck", "chest", "abdomen", "pelvis", "armL", "armR", "legL", "legR"];
const REGION_OF_SLOT = [0, 1, 2, 3, 4, 5, 5, 5, 5]; // head, throat, chest, abdomen, pelvis, limbs
const CHIN = 0.128;
const NECK = 0.172;
const RIBS = 0.33;
const WAIST = 0.44;
const slot = P.map(([x, t], i) => {
  if (isArm[i]) return x > 0 ? 5 : 6;
  if (t > crotchT) return x > 0 ? 7 : 8;
  if (t < CHIN) return 0;
  if (t < NECK) return 1;
  if (t < RIBS) return 2;
  if (t < WAIST) return 3;
  return 4;
});

// Soft weights: one-hot, then averaged over mesh neighbours so glows fade across joints.
let w = slot.map((s) => SLOTS.map((_, j) => (j === s ? 1 : 0)));
for (let it = 0; it < 3; it++) {
  w = w.map((own, i) => {
    const acc = own.map((v) => v * 2);
    for (const j of neighbours[i]) for (let k = 0; k < 9; k++) acc[k] += w[j][k];
    const sum = acc.reduce((a, b) => a + b, 0);
    return acc.map((v) => v / sum);
  });
}

// ---------- landmarks (joint centres) from the actual mesh ----------
const centroid = (pred) => {
  const pts = P.filter(pred);
  return pts.length ? [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length) : null;
};
const round = (v) => Math.round(v * 10000) / 10000;
const band = (t, h = 0.008) => (p) => p[1] >= t - h && p[1] < t + h;
const left = (pred, arm) => (p, i) => pred(p) && (arm ? isArm[i] : slot[i] === 7) && p[0] > 0;
const lm = {
  shoulder: (() => {
    const top = Math.min(...P.filter((p, i) => isArm[i] && p[0] > 0).map((p) => p[1]));
    return centroid((p, i) => isArm[i] && p[0] > 0 && p[1] < top + 0.04);
  })(),
  elbow: centroid(left(band(0.375), true)),
  wrist: centroid(left(band(0.475), true)),
  hip: centroid((p, i) => slot[i] === 7 && band(crotchT + 0.02, 0.01)(p)),
  knee: centroid(left(band(0.72), false)),
  ankle: centroid(left(band(0.945), false)),
};
const landmarks = Object.fromEntries(Object.entries(lm).map(([k, v]) => [k, v && v.map(round)]));

// ---------- write ----------
const tris = [];
for (const f of local) for (let k = 1; k + 1 < f.length; k++) tris.push(f[0], f[k], f[k + 1]);
const edgeList = [...edges].flatMap((e) => e.split(",").map(Number));
if (n > 65535) throw new Error("Too many vertices for 16-bit indices");

const parts = [
  ["positions", new Float32Array(P.flat())],
  ["weights", new Uint8Array(w.flatMap((ws) => ws.map((v) => Math.round(v * 255))))],
  ["regions", new Uint8Array(slot.map((s) => REGION_OF_SLOT[s]))],
  ["triangles", new Uint16Array(tris)],
  ["edges", new Uint16Array(edgeList)],
];
const offsets = {};
const chunks = [];
let offset = 0;
for (const [key, arr] of parts) {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) chunks.push(Buffer.alloc(pad));
  offset += pad;
  offsets[key] = { offset, length: arr.length };
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  chunks.push(buf);
  offset += buf.length;
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "models");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "body.bin"), Buffer.concat(chunks));
const meta = { source: name, vertices: n, triangles: tris.length / 3, edges: edgeList.length / 2, slots: SLOTS, crotch: round(crotchT), landmarks, offsets };
writeFileSync(join(out, "body.json"), JSON.stringify(meta, null, 2) + "\n");
console.log(JSON.stringify({ ...meta, offsets: undefined }, null, 2));
console.log(`body.bin: ${(offset / 1024).toFixed(0)} KB`);

// ---------- 2D outline per slot (front view) for the accessible 2D body map ----------
// Rasterise the front projection with a depth buffer (frontmost part wins), then
// trace each slot's mask into SVG paths (marching squares + simplification).
const VB_W = 140; // viewBox units: X = 70 + x * 200, Y = t * 200 (same as the 2D component)
const VB_H = 200;
const RS = 3; // raster pixels per viewBox unit
const GW = VB_W * RS;
const GH = VB_H * RS;
const owner = new Int8Array(GW * GH).fill(-1);
const depth = new Float32Array(GW * GH).fill(-Infinity);
const toPx = (p) => [(70 + p[0] * 200) * RS, p[1] * 200 * RS, p[2]];
for (let k = 0; k < tris.length; k += 3) {
  const [a, b, c] = [tris[k], tris[k + 1], tris[k + 2]].map((i) => toPx(P[i]));
  const s = slot[tris[k]];
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(GW - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(GH - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-9) continue;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den;
      const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den;
      const l3 = 1 - l1 - l2;
      if (l1 < -0.01 || l2 < -0.01 || l3 < -0.01) continue;
      const z = l1 * a[2] + l2 * b[2] + l3 * c[2];
      const idx = y * GW + x;
      if (z > depth[idx]) {
        depth[idx] = z;
        owner[idx] = s;
      }
    }
  }
}

function trace(mask) {
  // Marching squares on cell corners; segments keyed by endpoints, then linked into loops.
  const at = (x, y) => (x >= 0 && y >= 0 && x < GW && y < GH ? mask(y * GW + x) : false);
  const segs = new Map();
  const key = (x, y) => `${x},${y}`;
  const add = (p, q) => segs.set(key(...p), q);
  for (let y = -1; y < GH; y++) {
    for (let x = -1; x < GW; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code === 0 || code === 15) continue;
      // edge midpoints (doubled coordinates so they stay integers)
      const T = [2 * x + 2, 2 * y + 1], R = [2 * x + 3, 2 * y + 2], B = [2 * x + 2, 2 * y + 3], L = [2 * x + 1, 2 * y + 2];
      // orientation keeps the filled side on the left
      switch (code) {
        case 1: add(L, B); break;
        case 2: add(B, R); break;
        case 3: add(L, R); break;
        case 4: add(R, T); break;
        case 5: add(L, T); add(R, B); break;
        case 6: add(B, T); break;
        case 7: add(L, T); break;
        case 8: add(T, L); break;
        case 9: add(T, B); break;
        case 10: add(T, R); add(B, L); break;
        case 11: add(T, R); break;
        case 12: add(R, L); break;
        case 13: add(R, B); break;
        case 14: add(B, L); break;
      }
    }
  }
  const loops = [];
  while (segs.size) {
    const [startKey, first] = segs.entries().next().value;
    segs.delete(startKey);
    const loop = [startKey.split(",").map(Number), first];
    let cur = first;
    for (let guard = 0; guard < 1e6; guard++) {
      const k = key(...cur);
      const next = segs.get(k);
      if (!next) break;
      segs.delete(k);
      if (key(...next) === startKey) break;
      loop.push(next);
      cur = next;
    }
    if (loop.length > 8) loops.push(loop);
  }
  return loops;
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let worst = 0;
  let at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= eps) return [a, b];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

const toPath = (loops) =>
  loops
    .map((loop) => {
      const half = Math.floor(loop.length / 2);
      const pts = [...simplify(loop.slice(0, half + 1), 0.9), ...simplify(loop.slice(half), 0.9).slice(1)];
      return "M" + pts.map(([x, y]) => `${(x / 2 / RS).toFixed(1)} ${(y / 2 / RS).toFixed(1)}`).join("L") + "Z";
    })
    .join("");

const outline2d = {
  viewBox: `0 0 ${VB_W} ${VB_H}`,
  body: toPath(trace((i) => owner[i] >= 0)),
  slots: Object.fromEntries(SLOTS.map((name, s) => [name, toPath(trace((i) => owner[i] === s))])),
};
const out2d = join(dirname(fileURLToPath(import.meta.url)), "..", "components", "body-map", "generated");
mkdirSync(out2d, { recursive: true });
writeFileSync(join(out2d, "body2d.json"), JSON.stringify(outline2d) + "\n");
console.log(`body2d.json: ${(JSON.stringify(outline2d).length / 1024).toFixed(0)} KB`);
