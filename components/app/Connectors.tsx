"use client";

import { useCallback, useState } from "react";
import type { Region } from "@/lib/symptoms";

// Region anchor points in body-model space (x ∈ [-0.35, 0.35], y ∈ [0, 1]).
const ANCHORS: Partial<Record<Region, [number, number]>> = {
  head: [0.03, 0.07],
  throat: [0.02, 0.15],
  chest: [0.06, 0.27],
  abdomen: [0.05, 0.39],
  pelvis: [0.06, 0.475],
  limbs: [0.19, 0.42],
};

/**
 * HUD connector lines from each region with symptoms to the right edge of the
 * stage (toward the top-prediction panel). Projection matches the hologram camera
 * (body 2.2 units tall, fov 32° at z 4.2 → 0.913 of the stage height).
 */
export function Connectors({ counts, lit }: { counts: Record<Region, number>; lit?: Region | null }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ref = useCallback((el: SVGSVGElement | null) => {
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { w, h } = size;
  const regions = (Object.keys(ANCHORS) as Region[]).filter((r) => counts[r] > 0);
  const k = h * 0.913;

  return (
    <svg ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-[2] h-full w-full">
      {w > 0 &&
        regions.map((r, i) => {
          const [mx, my] = ANCHORS[r]!;
          const x = w / 2 + mx * k;
          const y = h * 0.0435 + my * k;
          const ty = h * 0.16 + i * 22;
          const on = lit === r;
          return (
            <g key={r} stroke={on ? "var(--accent)" : "color-mix(in oklab, var(--accent) 40%, transparent)"} strokeWidth={on ? 1.5 : 1} fill="none">
              <polyline points={`${x},${y} ${x + 36},${y} ${w - 40},${ty} ${w},${ty}`} />
              <circle cx={x} cy={y} r={3} fill="var(--accent)" stroke="none" />
            </g>
          );
        })}
    </svg>
  );
}
