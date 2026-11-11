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
    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Body regions">
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
            className={`flex min-h-8 items-center justify-between gap-1 rounded-full px-3 text-left text-[13px] font-medium transition-colors ${
              lit
                ? "bg-[var(--accent-fill)] text-white"
                : on
                  ? "bg-cyan/15 text-text"
                  : "bg-fill text-soft hover:bg-[var(--fill-hover)] hover:text-text"
            }`}
          >
            {SHORT[r]}
            {on && <span className={`font-mono text-[11px] ${lit ? "text-white" : "text-cyan"}`}>{counts[r]}</span>}
          </button>
        );
      })}
    </div>
  );
}
