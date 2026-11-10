"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Region } from "@/lib/symptoms";
import { generateBodyCloud, REGION_INDEX } from "./bodyModel";
import type { FigureProps } from "./types";

const SCALE = 2.2; // model units → world units (body is 2.2 tall)
const CYAN = new THREE.Color("#00f0ff");

/** Soft round sprite so each point renders as a glowing dot, not a square. */
function useDotTexture() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

function Cloud({ counts, active, hovered, scanning, onHover, onSelect, reduced, variant = "app" }: FigureProps) {
  const hero = variant === "hero";
  const cloud = useMemo(() => generateBodyCloud(hero ? 7000 : 5600), [hero]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(cloud.count * 3);
    for (let i = 0; i < cloud.count; i++) {
      pos[i * 3] = cloud.positions[i * 3] * SCALE;
      pos[i * 3 + 1] = (0.5 - cloud.positions[i * 3 + 1]) * SCALE;
      pos[i * 3 + 2] = cloud.positions[i * 3 + 2] * SCALE;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cloud.count * 3), 3));
    return g;
  }, [cloud]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const texture = useDotTexture();
  const group = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const tilt = useRef(0);

  // Keep the latest props in a ref so the frame loop never re-subscribes.
  const live = useRef({ counts, active, hovered, scanning, reduced });
  // Sync after each render; with reduced motion the canvas renders on demand, so also ask for a frame.
  useLayoutEffect(() => {
    live.current = { counts, active, hovered, scanning, reduced };
    invalidate();
  }, [counts, active, hovered, scanning, reduced, invalidate]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const { counts: c, active: a, hovered: h, scanning: scan, reduced: rm } = live.current;

    // Lean toward the cursor; gentle idle sway unless reduced motion.
    const px = state.pointer.x;
    const target = px * (hero ? 0.55 : 0.3) + (rm ? 0 : Math.sin(t * 0.3) * 0.12);
    tilt.current += (target - tilt.current) * (1 - Math.exp(-dt * 4));
    g.rotation.y = tilt.current;

    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = colors.array as Float32Array;
    const pulse = rm ? 0.18 : 0.15 + 0.15 * Math.sin(t * 3.1);
    const scanY = scan && !rm ? (t / 2.4) % 1 : -1;
    const cos = Math.cos(tilt.current);
    const sin = Math.sin(tilt.current);
    const cursor = hero ? { x: state.pointer.x * 1.6, y: state.pointer.y * 1.2 } : null;

    for (let i = 0; i < cloud.count; i++) {
      const region = REGION_INDEX[cloud.regions[i]];
      let k = cloud.brightness[i] * 0.5;
      if (c[region] > 0) k += 0.22 + pulse;
      if (a === region) k += 0.3;
      if (h === region) k = 1;
      if (scan && rm && c[region] > 0) k += 0.2;
      if (scanY >= 0 && Math.abs(cloud.positions[i * 3 + 1] - scanY) < 0.018) k = 1;
      if (cursor) {
        const wx = cloud.positions[i * 3] * SCALE * cos + cloud.positions[i * 3 + 2] * SCALE * sin;
        const wy = (0.5 - cloud.positions[i * 3 + 1]) * SCALE;
        const dx = wx - cursor.x;
        const dy = wy - cursor.y;
        if (dx * dx + dy * dy < 0.035) k = 1;
      }
      k = Math.min(1, k);
      arr[i * 3] = CYAN.r * k;
      arr[i * 3 + 1] = CYAN.g * k;
      arr[i * 3 + 2] = CYAN.b * k;
    }
    colors.needsUpdate = true;
  });

  const regionAt = (e: ThreeEvent<PointerEvent | MouseEvent>): Region | null =>
    e.index != null ? REGION_INDEX[cloud.regions[e.index]] : null;

  return (
    <group
      ref={group}
      onPointerMove={(e) => {
        if (hero) return;
        const r = regionAt(e);
        if (r !== live.current.hovered) onHover(r);
      }}
      onPointerOut={() => !hero && onHover(null)}
      onClick={(e) => {
        if (hero || e.delta > 4) return;
        const r = regionAt(e);
        if (r) onSelect(r);
      }}
    >
      <points geometry={geometry}>
        <pointsMaterial
          map={texture}
          size={hero ? 0.032 : 0.03}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export default function Hologram(props: FigureProps) {
  const label = props.variant === "hero"
    ? "Point-cloud hologram of a human body that leans toward your cursor"
    : "Point-cloud body map. Use the body region buttons to choose symptoms with a keyboard.";
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 32 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      raycaster={{ params: { Points: { threshold: 0.035 }, Mesh: {}, Line: { threshold: 1 }, LOD: {}, Sprite: {} } }}
      role="img"
      aria-label={label}
      style={{ touchAction: "pan-y" }}
      frameloop={props.reduced ? "demand" : "always"}
    >
      <Cloud {...props} />
    </Canvas>
  );
}
