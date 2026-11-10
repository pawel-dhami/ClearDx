"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Component, useState, useSyncExternalStore, type ReactNode } from "react";
import { springs } from "@/lib/motion";
import { REGION_LABELS, REGIONS, type Region } from "@/lib/symptoms";
import BodyMap2D from "./BodyMap2D";
import { RegionButtons } from "./RegionButtons";
import { SymptomPicker } from "../SymptomPicker";

// The WebGL scene is never on the critical path: loaded only on the client, after first paint.
const Hologram = dynamic(() => import("./Hologram"), {
  ssr: false,
  loading: () => <div className="skeleton absolute inset-[15%] opacity-30" aria-hidden />,
});

// ---------- environment detection (SSR-safe) ----------
const noop = () => () => {};
let webglCache: boolean | undefined;
function hasWebGL() {
  if (webglCache === undefined) {
    try {
      const c = document.createElement("canvas");
      webglCache = Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
    } catch {
      webglCache = false;
    }
  }
  return webglCache;
}
const SMALL = "(max-width: 1023px)";
const subscribeSmall = (cb: () => void) => {
  const m = window.matchMedia(SMALL);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function useBodyEnvironment() {
  const webgl = useSyncExternalStore(noop, hasWebGL, () => false);
  const small = useSyncExternalStore(subscribeSmall, () => window.matchMedia(SMALL).matches, () => true);
  return { webgl, small };
}

// ---------- Stage ----------

export interface BodyStageProps {
  counts: Record<Region, number>;
  activeRegion: Region | null;
  onSelectRegion: (r: Region | null) => void;
  /** Region highlighted from elsewhere (graph node, chip). */
  highlightRegion?: Region | null;
  onHoverRegion?: (r: Region | null) => void;
  scanning: boolean;
  selected: string[];
  onToggleSymptom: (label: string) => void;
  /** Optional overlay drawn on top of the stage (e.g. connector lines). */
  overlay?: ReactNode;
  className?: string;
}

/** The hologram stage: 3D point cloud (or 2D fallback), scan line, hover tag and symptom picker. */
export function BodyStage({
  counts,
  activeRegion,
  onSelectRegion,
  highlightRegion,
  onHoverRegion,
  scanning,
  selected,
  onToggleSymptom,
  overlay,
  className = "",
}: BodyStageProps) {
  const { webgl, small } = useBodyEnvironment();
  const reduced = useReducedMotion() ?? false;
  const [userMode, setUserMode] = useState<"3d" | "2d" | null>(null);
  const [hovered, setHovered] = useState<Region | null>(null);
  const mode = !webgl ? "2d" : (userMode ?? (small ? "2d" : "3d"));
  const shown = hovered ?? highlightRegion ?? null;

  const hover = (r: Region | null) => {
    setHovered(r);
    onHoverRegion?.(r);
  };
  const figure = {
    counts,
    active: activeRegion,
    scanning,
    hovered: shown,
    reduced,
    onHover: hover,
    onSelect: (r: Region) => onSelectRegion(activeRegion === r ? null : r),
  };

  return (
    <div className={`relative overflow-hidden border border-cyan/12 bg-cyan/[0.015] ${className}`}>
      <div aria-hidden className="ruler-y absolute inset-y-8 left-0" />
      <div aria-hidden className="ruler-x absolute inset-x-8 bottom-0" />

      <div className="absolute inset-0">
        {mode === "3d" ? (
          <WebGLBoundary fallback={<div className="absolute inset-[6%]"><BodyMap2D {...figure} /></div>}>
            <Hologram {...figure} />
          </WebGLBoundary>
        ) : (
          <div className="absolute inset-[6%]">
            <BodyMap2D {...figure} />
          </div>
        )}
      </div>

      {scanning && !reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-x-[8%] z-[3] h-0.5 animate-scan bg-cyan shadow-[0_0_15px_5px_rgb(0_240_255/0.35)]" />
      )}
      {overlay}

      {/* top bar: label + hovered region + view toggle */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={shown ?? (scanning ? "scan" : "idle")}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={springs.snappy}
            className="hud px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] uppercase"
          >
            {scanning ? (
              <span className="text-cyan">Scanning…</span>
            ) : shown ? (
              <span className="text-cyan">{REGION_LABELS[shown]}{counts[shown] ? ` · ${counts[shown]} selected` : ""}</span>
            ) : (
              <span className="text-muted">Body map · {mode === "3d" ? "point at a region" : "tap a region"}</span>
            )}
          </motion.span>
        </AnimatePresence>
        {webgl && (
          <div role="radiogroup" aria-label="Body map view" className="pointer-events-auto flex border border-line bg-ink/70">
            {(["3d", "2d"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setUserMode(m)}
                className={`min-h-8 px-2.5 font-mono text-xs uppercase ${mode === m ? "bg-cyan/12 text-cyan shadow-[inset_0_-2px_0_var(--color-cyan)]" : "text-muted hover:text-text"}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeRegion && (
          <SymptomPicker
            key={activeRegion}
            region={activeRegion}
            selected={selected}
            onToggle={onToggleSymptom}
            onClose={() => onSelectRegion(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Compatibility wrapper (self-managed state) ----------

interface BodyMapProps {
  selected: string[];
  counts: Record<Region, number>;
  scanning: boolean;
  onToggle: (label: string) => void;
}

/** Stage + region buttons with their own picker state. Kept for simple embeds. */
export function BodyMap({ selected, counts, scanning, onToggle }: BodyMapProps) {
  const [active, setActive] = useState<Region | null>(null);
  const [hovered, setHovered] = useState<Region | null>(null);
  return (
    <div className="flex h-full flex-col gap-3">
      <BodyStage
        counts={counts}
        activeRegion={active}
        onSelectRegion={setActive}
        highlightRegion={hovered}
        scanning={scanning}
        selected={selected}
        onToggleSymptom={onToggle}
        className="min-h-[420px] flex-1"
      />
      <RegionButtons counts={counts} active={active} highlighted={hovered} onSelect={(r) => setActive((c) => (c === r ? null : r))} onHover={setHovered} />
    </div>
  );
}

export { REGIONS };
