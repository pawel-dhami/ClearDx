"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useState } from "react";
import BodyMap2D from "@/components/body-map/BodyMap2D";
import { useBodyEnvironment } from "@/components/body-map/BodyMap";
import { REGIONS, REGION_LABELS, type Region } from "@/lib/symptoms";
import type { PartGlow } from "@/components/body-map/parts";

// Lazy: the WebGL scene never blocks the landing page's first paint.
const Hologram = dynamic(() => import("@/components/body-map/Hologram"), {
  ssr: false,
  loading: () => <div className="absolute inset-[18%] animate-pulse rounded-[40%] bg-fill" aria-hidden />,
});

/** Demo selection so the hero shows affected organs like a real session would (cough + shortness of breath). */
const DEMO_GLOW: PartGlow = { lungL: 0.9, lungR: 0.9, throat: 0.6 };
/** Region counts for the hover tag. */
const DEMO_COUNTS = Object.fromEntries(REGIONS.map((r) => [r, r === "chest" ? 2 : r === "throat" ? 1 : 0])) as Record<Region, number>;

/** Landing hero: the live 3D body, leaning toward the cursor, with a tag on the region under it. */
export function HeroBody({ compact = false }: { compact?: boolean }) {
  const { webgl } = useBodyEnvironment();
  const reduced = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState<Region | null>(null);
  const figure = {
    counts: DEMO_COUNTS,
    active: null,
    scanning: false,
    hovered,
    reduced,
    onHover: setHovered,
    onSelect: () => {},
    glow: DEMO_GLOW,
    variant: "hero" as const,
  };

  return (
    <div className="relative h-full w-full">
      {webgl ? (
        <Hologram {...figure} />
      ) : (
        <div className="absolute inset-[8%]">
          <BodyMap2D {...figure} />
        </div>
      )}
      {!compact && (
        <p aria-live="polite" className="pointer-events-none absolute top-4 right-0 z-10 text-right rounded-full border border-line bg-[var(--panel-strong)] px-3 py-1 text-xs font-medium text-muted shadow-sm">
          {hovered ? <span className="text-text">{REGION_LABELS[hovered]}{DEMO_COUNTS[hovered] ? ` · ${DEMO_COUNTS[hovered]} selected` : ""}</span> : "Hover the body"}
        </p>
      )}
    </div>
  );
}
