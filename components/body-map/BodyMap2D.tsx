"use client";

import type { KeyboardEvent } from "react";
import { REGION_LABELS } from "@/lib/symptoms";
import { SHAPES, SURFACE_SLOTS, type Shape } from "./bodyModel";
import { ORGANS, surfaceLevels, type Organ } from "./parts";
import { SPATIAL_REGIONS, type FigureProps, type SpatialRegion } from "./types";

// Model x ∈ [-0.35, 0.35], y ∈ [0, 1]  →  viewBox 140 × 200
const X = (x: number) => 70 + x * 200;
const Y = (y: number) => y * 200;

/** One body primitive as SVG: ellipsoids as ellipses, capsules as round-capped strokes. */
function Part({ s, fill }: { s: Shape; fill: string }) {
  return s.t === "e" ? (
    <ellipse cx={X(s.c[0])} cy={Y(s.c[1])} rx={s.r[0] * 200} ry={s.r[1] * 200} fill={fill} />
  ) : (
    <line x1={X(s.a[0])} y1={Y(s.a[1])} x2={X(s.b[0])} y2={Y(s.b[1])} stroke={fill} strokeWidth={(s.ra + s.rb) * 200 * 0.92} strokeLinecap="round" />
  );
}

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

const slotIndex = (s: Shape) => {
  const x = s.t === "e" ? s.c[0] : (s.a[0] + s.b[0]) / 2;
  if (s.part === "arm") return SURFACE_SLOTS.indexOf(x > 0 ? "armL" : "armR");
  if (s.part === "leg") return SURFACE_SLOTS.indexOf(x > 0 ? "legL" : "legR");
  return SURFACE_SLOTS.indexOf(s.part);
};

/**
 * Accessible 2D fallback: the same anatomy as the 3D figure, drawn as one soft
 * silhouette (a blur + threshold filter melts the parts together) with the organs
 * inside. Affected parts glow in the contrasting colour; each region is one
 * focusable button (Enter/Space to open its symptoms).
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
    <svg viewBox="22 -2 96 204" className="h-full w-full" role="group" aria-label="Body map, 2D">
      <defs>
        <filter id="body-soften" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.2" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
        </filter>
      </defs>

      {/* silhouette */}
      <g filter="url(#body-soften)">
        {SHAPES.map((s, i) => (
          <Part key={i} s={s} fill="var(--body-fill)" />
        ))}
      </g>

      {/* affected surface areas */}
      {SHAPES.map((s, i) => {
        const level = surface[slotIndex(s)];
        return level > 0 ? (
          <g key={i} filter="url(#body-soften)" opacity={level * 0.6}>
            <Part s={s} fill="var(--complement)" />
          </g>
        ) : null;
      })}

      {/* organs */}
      {ORGANS.map((o) => {
        const level = glow[o.id] ?? 0;
        if (o.show === "lit" && level === 0) return null;
        return <OrganShape key={o.id} o={o} fill={level > 0 ? "var(--complement)" : "var(--muted)"} opacity={level > 0 ? 0.55 + level * 0.4 : 0.18} />;
      })}

      {/* region highlights + hit areas */}
      {SPATIAL_REGIONS.map((r) => {
        const lit = hovered === r || active === r;
        const shapes = SHAPES.filter((s) => s.region === r);
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
            <g filter="url(#body-soften)" style={{ opacity: lit ? 0.35 : 0, transition: "opacity .2s" }}>
              {shapes.map((s, i) => (
                <Part key={i} s={s} fill="var(--accent)" />
              ))}
            </g>
            <g opacity="0">
              {shapes.map((s, i) => (
                <Part key={i} s={s} fill="#000" />
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
