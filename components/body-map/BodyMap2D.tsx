"use client";

import type { KeyboardEvent } from "react";
import { REGION_LABELS } from "@/lib/symptoms";
import { SURFACE_SLOTS, type SurfaceSlot } from "./bodyModel";
import outline from "./generated/body2d.json";
import { ORGANS, surfaceLevels, type Organ } from "./parts";
import { SPATIAL_REGIONS, type FigureProps, type SpatialRegion } from "./types";

// Model x ∈ [-0.35, 0.35], y ∈ [0, 1]  →  viewBox units (same mapping the outline was traced with)
const X = (x: number) => 70 + x * 200;
const Y = (y: number) => y * 200;

const SLOT_PATHS = outline.slots as Record<SurfaceSlot, string>;
const REGION_OF: Record<SurfaceSlot, SpatialRegion> = {
  head: "head",
  neck: "throat",
  chest: "chest",
  abdomen: "abdomen",
  pelvis: "pelvis",
  armL: "limbs",
  armR: "limbs",
  legL: "limbs",
  legR: "limbs",
};

function OrganShape({ o, fill, opacity }: { o: Organ; fill: string; opacity: number }) {
  const s = o.shape;
  if (s.kind === "ellipsoid")
    return (
      <ellipse
        cx={X(s.c[0])}
        cy={Y(s.c[1])}
        rx={s.r[0] * 200}
        ry={s.r[1] * 200}
        transform={s.tilt ? `rotate(${(-s.tilt * 180) / Math.PI} ${X(s.c[0])} ${Y(s.c[1])})` : undefined}
        fill={fill}
        opacity={opacity}
      />
    );
  if (s.kind === "tube")
    return (
      <polyline
        points={s.path.map((p) => `${X(p[0])},${Y(p[1])}`).join(" ")}
        fill="none"
        stroke={fill}
        strokeWidth={s.radius * 400}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
    );
  return (
    <g opacity={opacity}>
      {s.centers.map((c, i) => (
        <circle key={i} cx={X(c[0])} cy={Y(c[1])} r={s.radius * 200} fill={fill} />
      ))}
    </g>
  );
}

/**
 * Accessible 2D fallback: the front outline of the same body mesh, split into
 * regions, with the organs inside. Affected areas glow in the contrasting colour;
 * each region is one focusable button (Enter/Space to open its symptoms).
 */
export default function BodyMap2D({ active, hovered, onSelect, onHover, glow = {} }: FigureProps) {
  const onKey = (e: KeyboardEvent, r: SpatialRegion) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(r);
    }
  };
  const surface = surfaceLevels(glow);

  return (
    <svg viewBox="20 -2 100 204" className="h-full w-full" role="group" aria-label="Body map, 2D">
      {/* silhouette + affected areas */}
      {SURFACE_SLOTS.map((slot, i) => (
        <g key={slot}>
          <path d={SLOT_PATHS[slot]} fill="var(--body-fill)" fillRule="evenodd" stroke="var(--body-fill)" strokeWidth="0.6" strokeLinejoin="round" />
          {surface[i] > 0 && <path d={SLOT_PATHS[slot]} fill="var(--complement)" fillRule="evenodd" opacity={surface[i] * 0.55} />}
        </g>
      ))}

      {/* organs */}
      {ORGANS.map((o) => {
        const level = glow[o.id] ?? 0;
        if (o.show === "lit" && level === 0) return null;
        return <OrganShape key={o.id} o={o} fill={level > 0 ? "var(--complement)" : "var(--muted)"} opacity={level > 0 ? 0.55 + level * 0.4 : 0.18} />;
      })}

      {/* region highlights + hit areas */}
      {SPATIAL_REGIONS.map((r) => {
        const lit = hovered === r || active === r;
        const slots = SURFACE_SLOTS.filter((s) => REGION_OF[s] === r);
        return (
          <g
            key={r}
            role="button"
            tabIndex={0}
            aria-label={REGION_LABELS[r]}
            aria-expanded={active === r}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => onKey(e, r)}
            onPointerEnter={() => onHover(r)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(r)}
            onBlur={() => onHover(null)}
            className="cursor-pointer outline-none"
          >
            {slots.map((s) => (
              <path
                key={s}
                d={SLOT_PATHS[s]}
                fillRule="evenodd"
                fill="var(--accent)"
                stroke={lit ? "var(--accent)" : "none"}
                strokeWidth="0.8"
                style={{ fillOpacity: lit ? 0.3 : 0, transition: "fill-opacity .2s" }}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
