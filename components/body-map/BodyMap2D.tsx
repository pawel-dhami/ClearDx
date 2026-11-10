"use client";

import { motion } from "motion/react";
import type { KeyboardEvent } from "react";
import { REGION_LABELS } from "@/lib/symptoms";
import type { FigureProps, SpatialRegion } from "./types";

/** Shapes in a 200 × 420 viewBox. Limbs are several shapes sharing one region. */
const SHAPES: { region: SpatialRegion; d: string }[] = [
  { region: "head", d: "M100 14 a30 32 0 1 1 -0.1 0 Z" },
  { region: "throat", d: "M88 76 h24 v18 q-12 6 -24 0 Z" },
  { region: "chest", d: "M62 98 q38 -12 76 0 l4 64 h-84 Z" },
  { region: "abdomen", d: "M60 166 h80 l-2 50 h-76 Z" },
  { region: "pelvis", d: "M62 220 h76 q2 22 -10 36 h-56 q-12 -14 -10 -36 Z" },
  // arms
  { region: "limbs", d: "M56 100 q-14 4 -18 22 l-14 110 q-1 10 8 11 q8 1 10 -8 l16 -100 Z" },
  { region: "limbs", d: "M144 100 q14 4 18 22 l14 110 q1 10 -8 11 q-8 1 -10 -8 l-16 -100 Z" },
  // legs
  { region: "limbs", d: "M72 260 h26 l-2 140 q-1 10 -11 10 q-10 0 -11 -10 Z" },
  { region: "limbs", d: "M102 260 h26 l-2 140 q-1 10 -11 10 q-10 0 -11 -10 Z" },
];

/** Where to draw the count badge for each region. */
const BADGE: Record<SpatialRegion, [number, number]> = {
  head: [128, 22],
  throat: [120, 82],
  chest: [146, 112],
  abdomen: [148, 176],
  pelvis: [146, 228],
  limbs: [182, 230],
};

export default function BodyMap2D({ counts, active, scanning, onSelect, onHover, hovered }: FigureProps) {
  const onKey = (e: KeyboardEvent, region: SpatialRegion) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(region);
    }
  };

  // Only the first shape of each region is focusable, so Tab visits each region once.
  const seen = new Set<SpatialRegion>();

  return (
    <svg viewBox="0 0 200 420" className="h-full max-h-[460px] w-full" role="group" aria-label="Body map">
      <defs>
        <linearGradient id="scan" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5eead4" stopOpacity="0" />
          <stop offset="0.5" stopColor="#5eead4" stopOpacity="0.55" />
          <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="body-clip">
          {SHAPES.map((s, i) => (
            <path key={i} d={s.d} />
          ))}
        </clipPath>
      </defs>

      {SHAPES.map((s, i) => {
        const count = counts[s.region];
        const isHover = hovered === s.region;
        const isActive = active === s.region;
        const focusable = !seen.has(s.region);
        seen.add(s.region);
        const fill = isActive ? 0.42 : count > 0 ? 0.3 : isHover ? 0.2 : 0.07;
        return (
          <motion.path
            key={i}
            d={s.d}
            role={focusable ? "button" : undefined}
            tabIndex={focusable ? 0 : -1}
            aria-label={focusable ? `${REGION_LABELS[s.region]}${count ? `, ${count} selected` : ""}` : undefined}
            aria-hidden={focusable ? undefined : true}
            aria-pressed={focusable ? isActive : undefined}
            onClick={() => onSelect(s.region)}
            onKeyDown={(e) => onKey(e, s.region)}
            onPointerEnter={() => onHover(s.region)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(s.region)}
            onBlur={() => onHover(null)}
            className="cursor-pointer outline-none"
            stroke="#5eead4"
            strokeWidth={isHover || isActive ? 1.6 : 0.9}
            filter={count > 0 || isActive ? "url(#glow)" : undefined}
            initial={false}
            animate={{
              fill: `rgba(94, 234, 212, ${fill})`,
              strokeOpacity: isHover || isActive ? 1 : 0.55,
              opacity: scanning ? [0.65, 1, 0.65] : 1,
            }}
            transition={
              scanning
                ? { opacity: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }, default: { type: "spring", stiffness: 300, damping: 25 } }
                : { type: "spring", stiffness: 300, damping: 25 }
            }
          />
        );
      })}

      {/* Scan beam, clipped to the body silhouette */}
      {scanning && (
        <g clipPath="url(#body-clip)" pointerEvents="none">
          <motion.rect
            x="0"
            width="200"
            height="70"
            fill="url(#scan)"
            initial={{ y: -70 }}
            animate={{ y: [-70, 420, -70] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </g>
      )}

      {(Object.keys(BADGE) as SpatialRegion[]).map((r) =>
        counts[r] > 0 ? (
          <motion.g
            key={r}
            pointerEvents="none"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
            style={{ originX: `${BADGE[r][0]}px`, originY: `${BADGE[r][1]}px` }}
          >
            <circle cx={BADGE[r][0]} cy={BADGE[r][1]} r="9" fill="#0a0e18" stroke="#5eead4" strokeWidth="1.2" />
            <text
              x={BADGE[r][0]}
              y={BADGE[r][1] + 3.5}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#5eead4"
            >
              {counts[r]}
            </text>
          </motion.g>
        ) : null,
      )}
    </svg>
  );
}
