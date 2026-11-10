"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Component, useState, useSyncExternalStore, type ReactNode } from "react";
import { springs } from "@/lib/motion";
import { REGIONS, REGION_LABELS, type Region } from "@/lib/symptoms";
import BodyMap2D from "./BodyMap2D";
import { SymptomPicker } from "../SymptomPicker";

const BodyMap3D = dynamic(() => import("./BodyMap3D"), {
  ssr: false,
  loading: () => <div className="skeleton mx-auto h-full w-2/3 opacity-40" />,
});

// ---------- environment detection (SSR-safe) ----------

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const m = window.matchMedia(query);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  };
}
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

const SMALL = "(max-width: 639px)";
const subscribeSmall = subscribeMedia(SMALL);

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ---------- component ----------

interface BodyMapProps {
  selected: string[];
  counts: Record<Region, number>;
  scanning: boolean;
  onToggle: (label: string) => void;
}

export function BodyMap({ selected, counts, scanning, onToggle }: BodyMapProps) {
  const [active, setActive] = useState<Region | null>(null);
  const [hovered, setHovered] = useState<Region | null>(null);
  const [userMode, setUserMode] = useState<"3d" | "2d" | null>(null);

  const webgl = useSyncExternalStore(noop, hasWebGL, () => false);
  const small = useSyncExternalStore(subscribeSmall, () => window.matchMedia(SMALL).matches, () => true);
  const mode = !webgl ? "2d" : (userMode ?? (small ? "2d" : "3d"));

  const select = (r: Region) => setActive((cur) => (cur === r ? null : r));
  const figure = { counts, active, scanning, hovered, onHover: setHovered, onSelect: select };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="relative min-h-[380px] flex-1 lg:max-h-[600px] lg:min-h-[460px]">
        {/* soft halo behind the figure */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[15%] inset-y-[10%] rounded-full bg-neon-cyan/10 blur-3xl"
        />

        <div className="absolute inset-0">
          {mode === "3d" ? (
            <WebGLBoundary fallback={<BodyMap2D {...figure} />}>
              <BodyMap3D {...figure} />
            </WebGLBoundary>
          ) : (
            <BodyMap2D {...figure} />
          )}
        </div>

        {/* top bar: hovered region + mode toggle */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2">
          <AnimatePresence mode="wait">
            <motion.span
              key={hovered ?? (scanning ? "scan" : "hint")}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={springs.snappy}
              className="rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-muted backdrop-blur"
            >
              {scanning ? (
                <span className="text-neon-cyan">Scanning symptoms…</span>
              ) : hovered ? (
                <span className="text-text">{REGION_LABELS[hovered]}</span>
              ) : mode === "3d" ? (
                "Click a region · drag to rotate"
              ) : (
                "Tap a region"
              )}
            </motion.span>
          </AnimatePresence>
          {webgl && (
            <div className="pointer-events-auto flex rounded-full border border-line bg-surface/70 p-0.5 text-xs backdrop-blur">
              {(["3d", "2d"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setUserMode(m)}
                  aria-pressed={mode === m}
                  className="relative rounded-full px-2.5 py-0.5 uppercase"
                >
                  {mode === m && (
                    <motion.span
                      layoutId="mode-pill"
                      transition={springs.snappy}
                      className="absolute inset-0 rounded-full bg-neon-cyan/20"
                    />
                  )}
                  <span className={`relative ${mode === m ? "text-neon-cyan" : "text-muted"}`}>{m}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence>
          {active && (
            <SymptomPicker
              key={active}
              region={active}
              selected={selected}
              onToggle={onToggle}
              onClose={() => setActive(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Region list: keyboard-friendly alternative, and the only entry point for skin / whole-body. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Body regions">
        {REGIONS.map((r) => (
          <motion.button
            key={r}
            onClick={() => select(r)}
            onPointerEnter={() => setHovered(r)}
            onPointerLeave={() => setHovered(null)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.94 }}
            transition={springs.snappy}
            aria-expanded={active === r}
            aria-label={`${REGION_LABELS[r]}${counts[r] ? `, ${counts[r]} selected` : ""}`}
            className={`flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active === r
                ? "border-neon-violet/60 bg-neon-violet/15 text-text"
                : counts[r] > 0
                  ? "border-neon-cyan/40 bg-neon-cyan/10 text-text"
                  : "border-line text-muted hover:text-text"
            }`}
          >
            {REGION_LABELS[r]}
            {counts[r] > 0 && (
              <span className="rounded-full bg-neon-cyan/25 px-1.5 text-[10px] font-semibold text-neon-cyan">
                {counts[r]}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
