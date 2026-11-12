"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Region } from "@/lib/symptoms";
import { readAccentRGB, readComplementRGB, useThemeState } from "@/lib/theme";
import { REGION_INDEX, type Vec3 } from "./bodyModel";
import { loadBodyMesh, type BodyMesh } from "./bodyMesh";
import { ORGANS, surfaceLevels, type Organ, type PartGlow } from "./parts";
import type { FigureProps } from "./types";

const SCALE = 2.2; // model units → world units (the body is 2.2 tall)

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

// ---------- geometry (built once from the loaded mesh, cached) ----------

interface BodyGeometry {
  surface: THREE.BufferGeometry;
  wire: THREE.BufferGeometry;
  regions: Uint8Array;
}
let cachedGeometry: { mesh: BodyMesh; geo: BodyGeometry } | null = null;

/** The scanned body: a smooth surface plus its quad edges (the wireframe), sharing vertex data. */
function bodyGeometry(mesh: BodyMesh): BodyGeometry {
  if (cachedGeometry?.mesh === mesh) return cachedGeometry.geo;
  const n = mesh.positions.length / 3;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const w = toWorld([mesh.positions[i * 3], mesh.positions[i * 3 + 1], mesh.positions[i * 3 + 2]]);
    pos[i * 3] = w.x;
    pos[i * 3 + 1] = w.y;
    pos[i * 3 + 2] = w.z;
  }
  const weights = [0, 1, 2].map((k) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) a[i * 3 + j] = mesh.weights[i * 9 + k * 3 + j] / 255;
    return new THREE.BufferAttribute(a, 3);
  });
  const surface = new THREE.BufferGeometry();
  surface.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  surface.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
  surface.computeVertexNormals();
  weights.forEach((w, k) => surface.setAttribute(`aW${k}`, w));
  surface.computeBoundingSphere();

  const wire = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "aW0", "aW1", "aW2"]) wire.setAttribute(name, surface.getAttribute(name));
  wire.setIndex(new THREE.BufferAttribute(mesh.edges, 1));
  wire.boundingSphere = surface.boundingSphere;

  const geo = { surface, wire, regions: mesh.regions };
  cachedGeometry = { mesh, geo };
  return geo;
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

/** Resting anatomical tints for the light theme: soft and desaturated so affected organs stand out. */
const ORGAN_TINT: Partial<Record<Organ["id"], string>> = {
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

const SURFACE_VERT = /* glsl */ `
attribute vec3 aW0;
attribute vec3 aW1;
attribute vec3 aW2;
uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uG2;
uniform vec3 uS0; uniform vec3 uS1; uniform vec3 uS2;
varying float vGlow;
varying float vSel;
varying float vY;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vGlow = dot(aW0, uG0) + dot(aW1, uG1) + dot(aW2, uG2);
  vSel = dot(aW0, uS0) + dot(aW1, uS1) + dot(aW2, uS2);
  vY = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  vViewN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

const SURFACE_FRAG = /* glsl */ `
uniform vec3 uAccent;
uniform vec3 uComp;
uniform float uLight;
uniform float uScan;
uniform float uScanY;
varying float vGlow;
varying float vSel;
varying float vY;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vec3 vn = normalize(vViewN);
  if (!gl_FrontFacing) vn = -vn;
  float fres = pow(1.0 - clamp(abs(dot(vn, normalize(vViewPos))), 0.0, 1.0), 2.2);
  float diff = clamp(dot(vn, normalize(vec3(0.35, 0.55, 0.75))), 0.0, 1.0);
  float glow = clamp(vGlow, 0.0, 1.0);
  float sel = clamp(vSel, 0.0, 1.0);
  float band = uScan * smoothstep(0.07, 0.0, abs(vY - uScanY));
  vec3 col;
  float alpha;
  if (uLight < 0.5) {
    col = uAccent * (0.03 + 0.06 * diff + 0.38 * fres)
        + uComp * glow * (0.16 + 0.4 * fres)
        + uAccent * sel * 0.18
        + uAccent * band * 0.7;
    if (!gl_FrontFacing) col *= 0.4;
    alpha = 1.0;
  } else {
    vec3 base = vec3(0.965, 0.972, 0.985) * (0.8 + 0.2 * diff);
    col = mix(base, uAccent, fres * 0.22);
    col = mix(col, uComp, glow * 0.5);
    col = mix(col, uAccent, sel * 0.25 + band * 0.55);
    alpha = 0.4 + fres * 0.32 + glow * 0.22 + sel * 0.1;
  }
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;

const WIRE_VERT = /* glsl */ `
attribute vec3 aW0;
attribute vec3 aW1;
attribute vec3 aW2;
uniform vec3 uG0; uniform vec3 uG1; uniform vec3 uG2;
uniform vec3 uS0; uniform vec3 uS1; uniform vec3 uS2;
varying float vGlow;
varying float vSel;
varying float vFacing;
varying float vY;
void main() {
  vGlow = dot(aW0, uG0) + dot(aW1, uG1) + dot(aW2, uG2);
  vSel = dot(aW0, uS0) + dot(aW1, uS1) + dot(aW2, uS2);
  vY = position.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFacing = dot(normalize(normalMatrix * normal), normalize(-mv.xyz));
  gl_Position = projectionMatrix * mv;
}`;

const WIRE_FRAG = /* glsl */ `
uniform vec3 uAccent;
uniform vec3 uComp;
uniform float uLight;
uniform float uScan;
uniform float uScanY;
varying float vGlow;
varying float vSel;
varying float vFacing;
varying float vY;
void main() {
  float glow = clamp(vGlow, 0.0, 1.0);
  float sel = clamp(vSel, 0.0, 1.0);
  float front = smoothstep(-0.15, 0.35, vFacing);
  float band = uScan * smoothstep(0.07, 0.0, abs(vY - uScanY));
  vec3 line = mix(uAccent, uComp, glow);
  if (uLight < 0.5) {
    float k = (0.22 + 0.5 * front) * (1.0 + 0.9 * glow + 0.5 * sel) + band;
    gl_FragColor = vec4(line * k, 1.0);
  } else {
    float a = (0.16 + 0.2 * front) + glow * 0.5 + sel * 0.2 + band * 0.5;
    gl_FragColor = vec4(line, clamp(a, 0.0, 1.0) * front);
  }
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
  const shared = {
    uAccent: { value: accent },
    uComp: { value: comp },
    uLight: light,
    uScan: { value: 0 },
    uScanY: { value: 0 },
    uG0: { value: new THREE.Vector3() },
    uG1: { value: new THREE.Vector3() },
    uG2: { value: new THREE.Vector3() },
    uS0: { value: new THREE.Vector3() },
    uS1: { value: new THREE.Vector3() },
    uS2: { value: new THREE.Vector3() },
  };
  const surface = new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: SURFACE_VERT,
    fragmentShader: SURFACE_FRAG,
    transparent: true,
    depthWrite: false,
    polygonOffset: true, // keep the wireframe drawn on top of the surface it sits on
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const wire = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: WIRE_VERT, fragmentShader: WIRE_FRAG, transparent: true, depthWrite: false });
  const glowVecs = [shared.uG0.value, shared.uG1.value, shared.uG2.value];
  const selVecs = [shared.uS0.value, shared.uS1.value, shared.uS2.value];

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
    surface,
    wire,
    organs,
    /** Dark: glowing wireframe hologram (additive). Light: frosted translucent anatomy with fine lines. */
    setTheme(isLight: boolean, accentRGB: [number, number, number], compRGB: [number, number, number]) {
      light.value = isLight ? 1 : 0;
      accent.setRGB(...accentRGB, THREE.SRGBColorSpace);
      comp.setRGB(...compRGB, THREE.SRGBColorSpace);
      const blend = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
      surface.blending = blend;
      surface.side = isLight ? THREE.FrontSide : THREE.DoubleSide;
      surface.depthWrite = isLight; // in light mode the surface hides the far side's lines
      wire.blending = blend;
      surface.needsUpdate = true;
      wire.needsUpdate = true;
      for (const o of organs) {
        o.uniforms.uColor.value.set(isLight ? (ORGAN_TINT[o.organ.id] ?? "#e5a0a0") : accent);
        o.material.blending = blend;
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
      shared.uScan.value = on ? 1 : 0;
      shared.uScanY.value = y;
    },
    dispose() {
      surface.dispose();
      wire.dispose();
      for (const o of organs) o.material.dispose();
    },
  };
}

// ---------- scene ----------

const ease = (cur: number, goal: number, dt: number, rate = 8) => cur + (goal - cur) * (1 - Math.exp(-dt * rate));

function Body({ active, hovered, scanning, onHover, onSelect, reduced, glow, variant = "app" }: FigureProps) {
  const hero = variant === "hero";
  const { surface, wire, regions } = bodyGeometry(use(loadBodyMesh()));
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
        geometry={surface}
        material={scene.surface}
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
      <lineSegments geometry={wire} material={scene.wire} renderOrder={3} raycast={() => null} />
    </group>
  );
}

/** If the body model can't load, render nothing (the stage's own fallback still offers the 2D map). */
class LoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
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
      camera={{ position: [0, 0, 4.6], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      role="img"
      aria-label={label}
      style={{ touchAction: "pan-y" }}
      frameloop={props.reduced ? "demand" : "always"}
    >
      <LoadBoundary>
        <Suspense fallback={null}>
          <Body {...props} />
        </Suspense>
      </LoadBoundary>
      {light && <ContactShadows position={[0, -1.12, 0]} scale={2.4} blur={2.4} far={1.2} opacity={0.22} resolution={256} />}
    </Canvas>
  );
}
