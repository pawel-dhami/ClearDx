"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useState } from "react";
import BodyMap2D from "@/components/body-map/BodyMap2D";
import { useBodyEnvironment } from "@/components/body-map/BodyMap";
import { REGIONS, REGION_LABELS, type Region } from "@/lib/symptoms";

// Lazy: the WebGL scene never blocks the landing page's first paint.
const Hologram = dynamic(() => import("@/components/body-map/Hologram"), {
  ssr: false,
  loading: () => <div className="absolute inset-[18%] animate-pulse bg-cyan/[0.03]" aria-hidden />,
});

/** Demo selection so the hero shows pulsing regions like a real session would. */
const DEMO_COUNTS = Object.fromEntries(REGIONS.map((r) => [r, r === "chest" ? 2 : r === "head" || r === "limbs" ? 1 : 0])) as Record<Region, number>;

/** Landing hero: the live point-cloud body, leaning toward the cursor, with a tag on the region under it. */
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
      {!compact && !reduced && (
        <div aria-hidden className="pointer-events-none absolute inset-x-[8%] z-[3] h-0.5 animate-scan bg-cyan shadow-[0_0_15px_5px_color-mix(in_oklab,var(--accent)_35%,transparent)]" />
      )}
      {!compact && (
        <p aria-live="polite" className="pointer-events-none absolute top-4 right-0 z-10 text-right font-mono text-xs leading-6 tracking-[0.08em] text-muted uppercase">
          {hovered ? <span className="text-cyan">{REGION_LABELS[hovered]}{DEMO_COUNTS[hovered] ? ` · ${DEMO_COUNTS[hovered]} selected` : ""}</span> : "Region · —"}
          <br />
          Pts <span className="text-cyan">7,000</span>
        </p>
      )}
    </div>
  );
}
