"use client";

import type { KeyboardEvent } from "react";
import { REGION_LABELS } from "@/lib/symptoms";
import { SHAPES } from "./bodyModel";
import { SPATIAL_REGIONS, type FigureProps, type SpatialRegion } from "./types";

// Model x ∈ [-0.35, 0.35], y ∈ [0, 1]  →  viewBox 140 × 200
const X = (x: number) => 70 + x * 200;
const Y = (y: number) => y * 200;

/**
 * Accessible 2D fallback: the same anatomy as the 3D cloud, drawn as dotted SVG
 * regions. Each region is one focusable button (Enter/Space to open its symptoms).
 */
export default function BodyMap2D({ counts, active, hovered, onSelect, onHover }: FigureProps) {
  const onKey = (e: KeyboardEvent, r: SpatialRegion) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(r);
    }
  };

  return (
    <svg viewBox="0 0 140 200" className="h-full w-full" role="group" aria-label="Body map, 2D">
      <defs>
        <pattern id="dots" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="0.55" fill="var(--accent)" />
        </pattern>
        <pattern id="dots-strong" width="2" height="2" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.75" fill="var(--accent)" />
        </pattern>
      </defs>
      {SPATIAL_REGIONS.map((r) => {
        const shapes = SHAPES.filter((s) => s.r === r);
        const on = counts[r] > 0;
        const lit = hovered === r || active === r;
        const paint = lit || on ? "url(#dots-strong)" : "url(#dots)";
        const opacity = lit ? 1 : on ? 0.85 : 0.45;
        return (
          <g
            key={r}
            role="button"
            tabIndex={0}
            aria-label={`${REGION_LABELS[r]}${counts[r] ? `, ${counts[r]} selected` : ""}`}
            aria-expanded={active === r}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => onKey(e, r)}
            onPointerEnter={() => onHover(r)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(r)}
            onBlur={() => onHover(null)}
            className="cursor-pointer outline-none [&:focus-visible>*]:stroke-cyan"
            style={{ opacity, transition: "opacity .16s" }}
          >
            {shapes.map((s, i) =>
              s.t === "e" ? (
                <ellipse key={i} cx={X(s.cx)} cy={Y(s.cy)} rx={s.rx * 200} ry={s.ry * 200} fill={paint}
                  stroke={lit ? "var(--accent)" : "color-mix(in oklab, var(--accent) 35%, transparent)"} strokeWidth={lit ? 0.8 : 0.4} />
              ) : (
                <g key={i}>
                  <line x1={X(s.ax)} y1={Y(s.ay)} x2={X(s.bx)} y2={Y(s.by)} stroke={lit ? "var(--accent)" : "color-mix(in oklab, var(--accent) 35%, transparent)"}
                    strokeWidth={s.w * 400 + (lit ? 1.6 : 0.8)} strokeLinecap="round" />
                  <line x1={X(s.ax)} y1={Y(s.ay)} x2={X(s.bx)} y2={Y(s.by)} stroke="var(--ink)" strokeWidth={s.w * 400} strokeLinecap="round" />
                  <line x1={X(s.ax)} y1={Y(s.ay)} x2={X(s.bx)} y2={Y(s.by)} stroke={paint} strokeWidth={s.w * 400} strokeLinecap="round" />
                </g>
              ),
            )}
          </g>
        );
      })}
    </svg>
  );
}
