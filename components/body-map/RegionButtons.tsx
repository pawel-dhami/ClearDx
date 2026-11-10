"use client";

import { REGION_LABELS, REGIONS, type Region } from "@/lib/symptoms";

const SHORT: Record<Region, string> = {
  head: "Head",
  throat: "Throat",
  chest: "Chest",
  abdomen: "Abdo",
  pelvis: "Pelvis",
  limbs: "Limbs",
  skin: "Skin",
  general: "Whole",
};

interface RegionButtonsProps {
  counts: Record<Region, number>;
  active: Region | null;
  highlighted?: Region | null;
  onSelect: (r: Region) => void;
  onHover?: (r: Region | null) => void;
}

/**
 * Keyboard-friendly list of every body region (and the only entry point for skin and whole-body).
 * Compact 4-column grid with selected-symptom counts.
 */
export function RegionButtons({ counts, active, highlighted, onSelect, onHover }: RegionButtonsProps) {
  return (
    <div className="grid grid-cols-4 gap-1" role="group" aria-label="Body regions">
      {REGIONS.map((r) => {
        const on = counts[r] > 0;
        const lit = highlighted === r || active === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onSelect(r)}
            onPointerEnter={() => onHover?.(r)}
            onPointerLeave={() => onHover?.(null)}
            aria-expanded={active === r}
            aria-label={`${REGION_LABELS[r]}${on ? `, ${counts[r]} selected` : ""}`}
            className={`flex min-h-8 items-center justify-between gap-1 border px-1.5 text-left text-xs transition-colors ${
              lit
                ? "border-cyan text-text shadow-[0_0_10px_rgb(0_240_255/0.3)]"
                : on
                  ? "border-line bg-cyan/6 text-text"
                  : "border-cyan/12 text-muted hover:border-cyan hover:text-text"
            }`}
          >
            {SHORT[r]}
            {on && <span className="font-mono text-[11px] text-cyan">{counts[r]}</span>}
          </button>
        );
      })}
    </div>
  );
}
