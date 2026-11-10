import type { Region } from "@/lib/symptoms";

/** Regions that exist on the figure. "skin" and "general" are whole-body and get buttons instead. */
export const SPATIAL_REGIONS = ["head", "throat", "chest", "abdomen", "pelvis", "limbs"] as const;
export type SpatialRegion = (typeof SPATIAL_REGIONS)[number];

export interface FigureProps {
  /** Selected-symptom count per region, drives the glow. */
  counts: Record<Region, number>;
  /** Region whose picker is open. */
  active: Region | null;
  /** Plays the scan animation (prediction in flight). */
  scanning: boolean;
  onSelect: (region: Region) => void;
  onHover: (region: Region | null) => void;
  hovered: Region | null;
  /** prefers-reduced-motion: drop idle/scan movement, keep state changes. */
  reduced?: boolean;
}
