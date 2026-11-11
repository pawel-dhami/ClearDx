"use client";

import BodyMap2D from "@/components/body-map/BodyMap2D";
import { pct } from "@/lib/explain";
import type { Prediction } from "@/lib/predict/types";
import { REGION_LABELS, type Region } from "@/lib/symptoms";

interface MobileBodyHeaderProps {
  counts: Record<Region, number>;
  top: Prediction | null;
  loading: boolean;
  error: boolean;
  expanded: boolean;
  onToggle: () => void;
}

/** Compact sticky header on small screens: mini body, selected regions, top match. Tap to open the full body map. */
export function MobileBodyHeader({ counts, top, loading, error, expanded, onToggle }: MobileBodyHeaderProps) {
  const regions = (Object.keys(counts) as Region[]).filter((r) => counts[r] > 0);
  return (
    <div className="sticky top-0 z-30 px-3 pt-2 lg:hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls="mobile-stage"
        className="hud-strong relative flex h-24 w-full items-center gap-3 px-3 text-left"
      >
        <span aria-hidden className="pointer-events-none h-20 w-12 shrink-0">
          <BodyMap2D counts={counts} active={null} hovered={null} scanning={loading} onHover={() => {}} onSelect={() => {}} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="label block">Body · {regions.length ? `${regions.length} region${regions.length > 1 ? "s" : ""}` : "no regions"}</span>
          <span className="mt-1 block truncate text-sm text-soft">
            {regions.length ? regions.map((r) => REGION_LABELS[r].split(" ")[0]).join(" · ") : "Tap to open the body map"}
          </span>
          <span className="mt-1 block text-[13px] font-medium text-cyan">{expanded ? "Hide body map" : "Show body map"}</span>
        </span>
        <span className="text-right" aria-live="polite">
          {loading ? (
            <span className="label !text-cyan">Analyzing…</span>
          ) : error ? (
            <span className="label !text-contra">Failed</span>
          ) : top ? (
            <>
              <span className="block font-display text-base leading-tight font-semibold">{top.condition}</span>
              <span className="font-mono text-2xl font-bold text-cyan">
                {pct(top.confidence)}
                <span className="text-sm text-muted">%</span>
              </span>
            </>
          ) : null}
        </span>
      </button>
    </div>
  );
}
