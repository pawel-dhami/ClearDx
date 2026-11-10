"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import { useRef, type ReactNode } from "react";
import * as THREE from "three";
import { REGION_LABELS, type Region } from "@/lib/symptoms";
import type { FigureProps, SpatialRegion } from "./types";

const CYAN = new THREE.Color("#5eead4");
const VIOLET = new THREE.Color("#a78bfa");
const BASE = new THREE.Color("#0f1b2d");

type Vec3 = [number, number, number];

interface PartDef {
  region: SpatialRegion;
  position: Vec3;
  rotation?: Vec3;
  geometry: ReactNode;
}

// Stylised low-poly figure built from primitives. Units ≈ metres-ish, figure spans y ∈ [-1.85, 1.65].
const PARTS: PartDef[] = [
  { region: "head", position: [0, 1.36, 0], geometry: <icosahedronGeometry args={[0.28, 1]} /> },
  { region: "throat", position: [0, 1.0, 0], geometry: <cylinderGeometry args={[0.1, 0.12, 0.2, 8]} /> },
  { region: "chest", position: [0, 0.64, 0], geometry: <boxGeometry args={[0.82, 0.56, 0.4]} /> },
  { region: "abdomen", position: [0, 0.16, 0], geometry: <boxGeometry args={[0.7, 0.38, 0.36]} /> },
  { region: "pelvis", position: [0, -0.2, 0], geometry: <boxGeometry args={[0.76, 0.3, 0.38]} /> },
  // arms
  { region: "limbs", position: [-0.56, 0.42, 0], rotation: [0, 0, -0.14], geometry: <capsuleGeometry args={[0.09, 0.92, 2, 6]} /> },
  { region: "limbs", position: [0.56, 0.42, 0], rotation: [0, 0, 0.14], geometry: <capsuleGeometry args={[0.09, 0.92, 2, 6]} /> },
  // legs
  { region: "limbs", position: [-0.2, -1.0, 0], geometry: <capsuleGeometry args={[0.12, 1.12, 2, 6]} /> },
  { region: "limbs", position: [0.2, -1.0, 0], geometry: <capsuleGeometry args={[0.12, 1.12, 2, 6]} /> },
];

/** Where each region's count badge floats. */
const BADGE_POS: Record<SpatialRegion, Vec3> = {
  head: [0.36, 1.5, 0],
  throat: [0.24, 1.04, 0],
  chest: [0.56, 0.84, 0],
  abdomen: [0.5, 0.2, 0],
  pelvis: [0.52, -0.2, 0],
  limbs: [0.84, 0.0, 0],
};

interface PartProps extends PartDef {
  state: Pick<FigureProps, "counts" | "active" | "hovered" | "scanning" | "reduced">;
  onSelect: (r: Region) => void;
  onHover: (r: Region | null) => void;
}

function Part({ region, position, rotation, geometry, state, onSelect, onHover }: PartProps) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const count = state.counts[region];
  const isActive = state.active === region;
  const isHover = state.hovered === region;

  useFrame(({ clock }, dt) => {
    const m = mat.current;
    if (!m) return;
    let target = isActive ? 1.4 : count > 0 ? 0.9 : isHover ? 0.6 : 0.12;
    if (state.scanning) target += state.reduced ? 0.4 : 0.35 + 0.35 * Math.sin(clock.elapsedTime * 4 + position[1] * 3);
    // Critically-damped-ish approach: frame-rate independent smoothing.
    const k = 1 - Math.exp(-dt * 10);
    m.emissiveIntensity += (target - m.emissiveIntensity) * k;
    m.emissive.lerp(isActive ? VIOLET : CYAN, k);
    const opacity = isHover || isActive || count > 0 ? 0.85 : 0.55;
    m.opacity += (opacity - m.opacity) * k;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(region);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    onHover(null);
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Ignore clicks that were really orbit drags.
    if (e.delta > 4) return;
    onSelect(region);
  };

  return (
    <mesh position={position} rotation={rotation} onPointerOver={over} onPointerOut={out} onClick={click}>
      {geometry}
      <meshStandardMaterial
        ref={mat}
        color={BASE}
        emissive={CYAN}
        emissiveIntensity={0.12}
        transparent
        opacity={0.55}
        roughness={0.35}
        metalness={0.2}
        flatShading
      />
      <Edges threshold={15} color={isActive ? "#c4b5fd" : "#5eead4"} />
    </mesh>
  );
}

function Marker({ position, count, reduced }: { position: Vec3; count: number; reduced?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    const m = ref.current;
    if (!m) return;
    // Spring in, then pulse gently; bigger for more symptoms.
    const target = (0.05 + Math.min(count, 4) * 0.012) * (reduced ? 1 : 1 + 0.15 * Math.sin(clock.elapsedTime * 3));
    const s = m.scale.x + (target - m.scale.x) * (1 - Math.exp(-dt * 12));
    m.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={position} scale={0.001}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color="#5eead4" toneMapped={false} />
    </mesh>
  );
}

function ScanRing({ active }: { active: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }, dt) => {
    if (!ref.current || !mat.current) return;
    const k = 1 - Math.exp(-dt * 8);
    mat.current.opacity += ((active ? 0.75 : 0) - mat.current.opacity) * k;
    ref.current.visible = mat.current.opacity > 0.01;
    // Sweep top → bottom → top.
    ref.current.position.y = 0.0 + Math.sin(clock.elapsedTime * 1.6) * 1.75 - 0.1;
  });
  return (
    <mesh ref={ref} visible={false}>
      <cylinderGeometry args={[0.95, 0.95, 0.05, 48, 1, true]} />
      <meshBasicMaterial
        ref={mat}
        color="#5eead4"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function Figure(props: FigureProps) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // gentle idle "breathing"
    if (group.current && !props.reduced) group.current.position.y = Math.sin(clock.elapsedTime * 1.2) * 0.025;
  });

  return (
    <group ref={group} onPointerMissed={() => props.onHover(null)}>
      {PARTS.map((p, i) => (
        <Part key={i} {...p} state={props} onSelect={props.onSelect} onHover={props.onHover} />
      ))}
      {/* Glowing markers on regions with symptoms. (drei <Html> badges were dropped: each creates its own
          React root, and unmounting it mid-render logs errors. Exact counts live on the region buttons.) */}
      {(Object.keys(BADGE_POS) as SpatialRegion[]).map((r) =>
        props.counts[r] > 0 ? <Marker key={r} position={BADGE_POS[r]} count={props.counts[r]} reduced={props.reduced} /> : null,
      )}
      {/* the sweeping ring is pure motion; with reduced motion the parts just brighten instead */}
      {!props.reduced && <ScanRing active={props.scanning} />}
      {/* floor ring */}
      <mesh position={[0, -1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.66, 64]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, -1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 0.87, 64]} />
        <meshBasicMaterial color="#a78bfa" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

export default function BodyMap3D(props: FigureProps) {
  const reduced = useReducedMotion() ?? false;
  return (
    <Canvas
      camera={{ position: [0, 0.05, 5.4], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      role="img"
      aria-label={`3D body figure${props.hovered ? `, pointing at ${REGION_LABELS[props.hovered]}` : ""}. Keyboard users: use the body region buttons below.`}
      style={{ touchAction: "pan-y" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <pointLight position={[-3, 1, 2]} color="#a78bfa" intensity={8} />
      <pointLight position={[3, -1, 2]} color="#5eead4" intensity={6} />
      <Figure {...props} reduced={reduced} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2 - 0.25}
        maxPolarAngle={Math.PI / 2 + 0.15}
        rotateSpeed={0.6}
        enableDamping
      />
    </Canvas>
  );
}
