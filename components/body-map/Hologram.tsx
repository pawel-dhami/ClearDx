"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Region } from "@/lib/symptoms";
import { readAccentRGB, readComplementRGB, useThemeState } from "@/lib/theme";
import { bodyDistance, REGION_INDEX, surfaceInfo, type Vec3 } from "./bodyModel";
import { ORGANS, surfaceLevels, type Organ, type PartGlow } from "./parts";
import type { FigureProps } from "./types";

const SCALE = 2.2; // model units → world units (the body is 2.2 tall)
const RES = 112; // voxels per side of the sampling grid
// The grid is stretched to the body: tall in y, narrow in x and z, so detail goes where the body is.
const SPAN: Vec3 = [0.26, 0.52, 0.26];

const toWorld = ([x, y, z]: Vec3): THREE.Vector3 => new THREE.Vector3(x * SCALE, (0.5 - y) * SCALE, z * SCALE);

/** Which surface slots each picker region covers (for hover / open highlights). */
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const REGION_SLOTS: Record<Region, number[]> = {
  head: [0],
  throat: [1],
  chest: [2],
  abdomen: [3],
  pelvis: [4],
  limbs: [5, 6, 7, 8],
  skin: ALL,
  general: ALL,
};

// ---------- geometry (built once, cached) ----------

let cachedBody: { geometry: THREE.BufferGeometry; regions: Uint8Array } | null = null;

/**
 * The body as one smooth surface: samples the blended distance field of the
 * anatomical primitives and extracts its iso-surface (marching cubes). Each
 * vertex stores its exact normal, its soft weights per surface slot and its region.
 */
function bodyGeometry() {
  if (cachedBody) return cachedBody;
  const mc = new MarchingCubes(RES, new THREE.MeshBasicMaterial(), false, false, 400_000);
  const half = RES / 2;
  const field = mc.field;
  for (let k = 0; k < RES; k++) {
    const z = ((k - half) / half) * SPAN[2];
    for (let j = 0; j < RES; j++) {
      const y = 0.5 - ((j - half) / half) * SPAN[1];
      for (let i = 0; i < RES; i++) {
        const x = ((i - half) / half) * SPAN[0];
        field[k * RES * RES + j * RES + i] = -bodyDistance(x, y, z) / 0.05;
      }
    }
  }
  mc.isolation = 0;
  mc.update();

  const n = mc.count;
  const src = mc.positionArray;
  const positions = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  const w0 = new Float32Array(n * 3);
  const w1 = new Float32Array(n * 3);
  const w2 = new Float32Array(n * 3);
  const regions = new Uint8Array(n);
  const h = 0.0015;
  for (let v = 0; v < n; v++) {
    const x = src[v * 3] * SPAN[0];
    const y = 0.5 - src[v * 3 + 1] * SPAN[1];
    const z = src[v * 3 + 2] * SPAN[2];
    positions[v * 3] = x * SCALE;
    positions[v * 3 + 1] = (0.5 - y) * SCALE;
    positions[v * 3 + 2] = z * SCALE;
    // exact normals from the distance field's gradient (model y points down)
    const nx = bodyDistance(x + h, y, z) - bodyDistance(x - h, y, z);
    const ny = bodyDistance(x, y - h, z) - bodyDistance(x, y + h, z);
    const nz = bodyDistance(x, y, z + h) - bodyDistance(x, y, z - h);
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[v * 3] = nx / len;
    normals[v * 3 + 1] = ny / len;
    normals[v * 3 + 2] = nz / len;
    const info = surfaceInfo(x, y, z);
    regions[v] = info.region;
    w0.set(info.weights.slice(0, 3), v * 3);
    w1.set(info.weights.slice(3, 6), v * 3);
    w2.set(info.weights.slice(6, 9), v * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  g.setAttribute("aW0", new THREE.BufferAttribute(w0, 3));
  g.setAttribute("aW1", new THREE.BufferAttribute(w1, 3));
  g.setAttribute("aW2", new THREE.BufferAttribute(w2, 3));
  g.computeBoundingSphere();
  mc.geometry.dispose();
  (mc.material as THREE.Material).dispose();
  cachedBody = { geometry: g, regions };
  return cachedBody;
}

function organGeometry(o: Organ): THREE.BufferGeometry {
  const s = o.shape;
  if (s.kind === "ellipsoid") {
    const g = new THREE.SphereGeometry(1, 36, 24);
    g.scale(s.r[0] * SCALE, s.r[1] * SCALE, s.r[2] * SCALE);
    if (s.tilt) g.rotateZ(-s.tilt);
    const c = toWorld(s.c);
    g.translate(c.x, c.y, c.z);
    return g;
  }
  if (s.kind === "tube") {
    const curve = new THREE.CatmullRomCurve3(s.path.map(toWorld));
    return new THREE.TubeGeometry(curve, Math.max(24, s.path.length * 14), s.radius * SCALE, 12, false);
  }
  const parts = s.centers.map((c) => {
    const g = new THREE.SphereGeometry(s.radius * SCALE, 18, 12);
    const w = toWorld(c);
    g.translate(w.x, w.y, w.z);
    return g;
  });
  return mergeGeometries(parts) ?? parts[0];
}

let cachedOrgans: { organ: Organ; geometry: THREE.BufferGeometry }[] | null = null;
const organGeometries = () => (cachedOrgans ??= ORGANS.map((organ) => ({ organ, geometry: organGeometry(organ) })));

/** Resting anatomical tints for the light theme (the dark theme uses the accent, hologram-style). */
const ORGAN_TINT: Partial<Record<Organ["id"], string>> = {
  // Soft, desaturated anatomy so affected organs (in the saturated contrasting colour) stand out.
  brain: "#ddd3d3",
  eyeL: "#eef1f5",
  eyeR: "#eef1f5",
  throat: "#dccaca",
  lungL: "#e2d0d0",
  lungR: "#e2d0d0",
  heart: "#d3b7b7",
  liver: "#cdb3ad",
  stomach: "#e0d1c4",
  intestines: "#e3d5c8",
  kidneyL: "#d1b8b4",
  kidneyR: "#d1b8b4",
  bladder: "#e4dcc2",
};

// ---------- shaders ----------

const BODY_VERT = /* glsl */ `
attribute vec3 aW0;
attribute vec3 aW1;
attribute vec3 aW2;
uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uG2;
uniform vec3 uS0; uniform vec3 uS1; uniform vec3 uS2;
varying float vGlow;
varying float vSel;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vGlow = dot(aW0, uG0) + dot(aW1, uG1) + dot(aW2, uG2);
  vSel = dot(aW0, uS0) + dot(aW1, uS1) + dot(aW2, uS2);
  vPos = position;
  vN = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  vViewN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

const BODY_FRAG = /* glsl */ `
uniform vec3 uAccent;
uniform vec3 uComp;
uniform float uLight;
uniform float uGrid;
uniform float uScan;
uniform float uScanY;
varying float vGlow;
varying float vSel;
varying vec3 vPos;
varying vec3 vN;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vec3 n = normalize(vN);
  vec3 vn = normalize(vViewN);
  if (!gl_FrontFacing) vn = -vn;
  vec3 vd = normalize(vViewPos);
  float fres = pow(1.0 - clamp(abs(dot(vn, vd)), 0.0, 1.0), 2.2);
  float diff = clamp(dot(vn, normalize(vec3(0.35, 0.55, 0.75))), 0.0, 1.0);

  // Wireframe-style grid: horizontal rings plus lines running along the surface.
  vec3 p = vPos / uGrid;
  vec3 w = max(fwidth(p), vec3(1e-4));
  vec3 a = abs(fract(p - 0.5) - 0.5) / w;
  vec3 l = 1.0 - clamp(a - 0.25, 0.0, 1.0);
  float grid = max(l.y * (1.0 - abs(n.y)), max(l.x * (1.0 - abs(n.x)), l.z * (1.0 - abs(n.z))));
  grid *= 1.0 - smoothstep(0.45, 0.9, max(w.x, max(w.y, w.z)));

  float glow = clamp(vGlow, 0.0, 1.0);
  float sel = clamp(vSel, 0.0, 1.0);
  float band = uScan * smoothstep(0.07, 0.0, abs(vPos.y - uScanY));
  vec3 col;
  float alpha;
  if (uLight < 0.5) {
    vec3 line = mix(uAccent, uComp, glow);
    col = uAccent * (0.035 + 0.07 * diff)
        + line * grid * (0.5 + 0.7 * glow)
        + uAccent * fres * 0.42
        + uComp * glow * (0.14 + 0.35 * fres)
        + uAccent * sel * 0.22
        + uAccent * band * 0.8;
    if (!gl_FrontFacing) col *= 0.45;
    alpha = 1.0;
  } else {
    vec3 base = vec3(0.965, 0.972, 0.985) * (0.84 + 0.16 * diff);
    col = mix(base, uAccent, grid * 0.38 + fres * 0.22);
    col = mix(col, uComp, glow * (0.42 + 0.4 * grid));
    col = mix(col, uAccent, sel * 0.28 + band * 0.6);
    alpha = 0.42 + fres * 0.3 + grid * 0.22 + glow * 0.2 + sel * 0.12;
  }
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

const ORGAN_VERT = /* glsl */ `
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  vViewN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

const ORGAN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uComp;
uniform float uLevel;
uniform float uRest;
uniform float uLight;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vec3 vn = normalize(vViewN);
  float fres = pow(1.0 - clamp(abs(dot(vn, normalize(vViewPos))), 0.0, 1.0), 2.0);
  float diff = clamp(dot(vn, normalize(vec3(0.35, 0.55, 0.75))), 0.0, 1.0);
  float lit = clamp(uLevel, 0.0, 1.0);
  vec3 col;
  float alpha;
  if (uLight < 0.5) {
    col = uColor * uRest * (0.12 + 0.18 * diff + 0.45 * fres) + uComp * lit * (0.45 + 0.35 * diff + 0.9 * fres);
    alpha = 1.0;
  } else {
    vec3 base = uColor * (0.7 + 0.3 * diff);
    col = mix(base, uComp, lit * 0.92) + uComp * lit * fres * 0.3;
    alpha = max(uRest * 0.7, lit * 0.97);
  }
  gl_FragColor = vec4(col, alpha);
}`;

// ---------- materials (built outside React so the frame loop can update uniforms) ----------

function createScene() {
  const accent = new THREE.Color(0.25, 0.5, 1);
  const comp = new THREE.Color(1, 0.3, 0.3);
  const light = { value: 0 };
  const bodyUniforms = {
    uAccent: { value: accent },
    uComp: { value: comp },
    uLight: light,
    uGrid: { value: 0.034 },
    uScan: { value: 0 },
    uScanY: { value: 0 },
    uG0: { value: new THREE.Vector3() },
    uG1: { value: new THREE.Vector3() },
    uG2: { value: new THREE.Vector3() },
    uS0: { value: new THREE.Vector3() },
    uS1: { value: new THREE.Vector3() },
    uS2: { value: new THREE.Vector3() },
  };
  const body = new THREE.ShaderMaterial({
    uniforms: bodyUniforms,
    vertexShader: BODY_VERT,
    fragmentShader: BODY_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const glowVecs = [bodyUniforms.uG0.value, bodyUniforms.uG1.value, bodyUniforms.uG2.value];
  const selVecs = [bodyUniforms.uS0.value, bodyUniforms.uS1.value, bodyUniforms.uS2.value];

  const organs = organGeometries().map(({ organ }) => {
    const uniforms = {
      uColor: { value: new THREE.Color() },
      uComp: { value: comp },
      uLevel: { value: 0 },
      uRest: { value: organ.show === "always" ? 1 : 0 },
      uLight: light,
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: ORGAN_VERT, fragmentShader: ORGAN_FRAG, transparent: true });
    return { organ, material, uniforms };
  });

  return {
    body,
    organs,
    /** Restyle for the theme: hologram (additive glow) in dark, translucent anatomy in light. */
    setTheme(isLight: boolean, accentRGB: [number, number, number], compRGB: [number, number, number]) {
      light.value = isLight ? 1 : 0;
      accent.setRGB(...accentRGB, THREE.SRGBColorSpace);
      comp.setRGB(...compRGB, THREE.SRGBColorSpace);
      body.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
      body.side = isLight ? THREE.FrontSide : THREE.DoubleSide;
      body.needsUpdate = true;
      for (const o of organs) {
        o.uniforms.uColor.value.set(isLight ? (ORGAN_TINT[o.organ.id] ?? "#e5a0a0") : accent);
        o.material.blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
        o.material.depthWrite = isLight;
        o.material.needsUpdate = true;
      }
    },
    setSurface(glow: number[], sel: number[]) {
      for (let i = 0; i < 9; i++) {
        glowVecs[Math.floor(i / 3)].setComponent(i % 3, glow[i]);
        selVecs[Math.floor(i / 3)].setComponent(i % 3, sel[i]);
      }
    },
    setOrgan(i: number, level: number) {
      organs[i].uniforms.uLevel.value = level;
    },
    setScan(on: boolean, y: number) {
      bodyUniforms.uScan.value = on ? 1 : 0;
      bodyUniforms.uScanY.value = y;
    },
    dispose() {
      body.dispose();
      for (const o of organs) o.material.dispose();
    },
  };
}

// ---------- scene ----------

const ease = (cur: number, goal: number, dt: number, rate = 8) => cur + (goal - cur) * (1 - Math.exp(-dt * rate));

function Body({ active, hovered, scanning, onHover, onSelect, reduced, glow, variant = "app" }: FigureProps) {
  const hero = variant === "hero";
  const { geometry, regions } = bodyGeometry();
  const organGeos = organGeometries();
  const scene = useMemo(() => createScene(), []);
  useEffect(() => () => scene.dispose(), [scene]);
  const { theme, hue } = useThemeState();
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const tilt = useRef(0);
  const levels = useRef({ surface: new Array<number>(9).fill(0), sel: new Array<number>(9).fill(0), organs: new Array<number>(ORGANS.length).fill(0) });

  useLayoutEffect(() => {
    scene.setTheme(theme === "light", readAccentRGB(), readComplementRGB());
    invalidate();
  }, [theme, hue, scene, invalidate]);

  // Keep the latest props in a ref so the frame loop never re-subscribes.
  const live = useRef({ active, hovered, scanning, reduced, glow: glow ?? ({} as PartGlow) });
  useLayoutEffect(() => {
    live.current = { active, hovered, scanning, reduced, glow: glow ?? {} };
    invalidate();
  }, [active, hovered, scanning, reduced, glow, invalidate]);

  useFrame((state, dt) => {
    const grp = group.current;
    if (!grp) return;
    const t = state.clock.elapsedTime;
    const { active: a, hovered: h, scanning: scan, reduced: rm, glow: g } = live.current;

    // Turn gently toward the cursor; slow idle sway unless reduced motion.
    const target = state.pointer.x * (hero ? 0.6 : 0.4) + (rm ? 0 : Math.sin(t * 0.3) * 0.16);
    tilt.current = ease(tilt.current, target, dt, 4);
    grp.rotation.y = tilt.current;

    const pulse = rm ? 1 : 0.86 + 0.14 * Math.sin(t * 2.4);
    const lv = levels.current;
    let moving = false;
    const step = (cur: number, goal: number) => {
      const next = rm ? goal : ease(cur, goal, dt);
      if (Math.abs(next - goal) > 0.003) moving = true;
      return next;
    };

    // Affected parts glow in the contrasting colour; hovered / open regions in the accent.
    const surfaceGoal = surfaceLevels(g);
    const selGoal = new Array<number>(9).fill(0);
    for (const s of a ? REGION_SLOTS[a] : []) selGoal[s] = 0.7;
    for (const s of h ? REGION_SLOTS[h] : []) selGoal[s] = 1;
    for (let i = 0; i < 9; i++) {
      lv.surface[i] = step(lv.surface[i], surfaceGoal[i]);
      lv.sel[i] = step(lv.sel[i], selGoal[i]);
    }
    scene.setSurface(lv.surface.map((v) => v * pulse), lv.sel);
    ORGANS.forEach((o, i) => {
      lv.organs[i] = step(lv.organs[i], g[o.id] ?? 0);
      scene.setOrgan(i, lv.organs[i] * pulse);
    });

    scene.setScan(scan && !rm, (SCALE / 2) * (1 - 2 * ((t / 2.4) % 1)));
    if (rm && moving) invalidate();
  });

  const regionAt = (e: ThreeEvent<PointerEvent | MouseEvent>): Region | null => (e.face ? REGION_INDEX[regions[e.face.a]] : null);

  return (
    <group ref={group}>
      {organGeos.map(({ organ, geometry: og }, i) => (
        <mesh key={organ.id} geometry={og} material={scene.organs[i].material} renderOrder={1} raycast={() => null} />
      ))}
      <mesh
        geometry={geometry}
        material={scene.body}
        renderOrder={2}
        onPointerMove={(e) => {
          e.stopPropagation();
          const r = regionAt(e);
          if (r !== live.current.hovered) onHover(r);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          if (hero || e.delta > 4) return;
          const r = regionAt(e);
          if (r) onSelect(r);
        }}
      />
    </group>
  );
}

export default function Hologram(props: FigureProps) {
  const { theme } = useThemeState();
  const light = theme === "light";
  const label =
    props.variant === "hero"
      ? "3D anatomical model of a human body that turns toward your cursor"
      : "3D anatomical body map. Affected organs and areas glow. Use the body region buttons to choose symptoms with a keyboard.";
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      role="img"
      aria-label={label}
      style={{ touchAction: "pan-y" }}
      frameloop={props.reduced ? "demand" : "always"}
    >
      <Body {...props} />
      {light && <ContactShadows position={[0, -1.12, 0]} scale={2.4} blur={2.4} far={1.2} opacity={0.22} resolution={256} />}
    </Canvas>
  );
}
