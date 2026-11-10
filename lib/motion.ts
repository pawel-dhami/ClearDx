import type { Transition } from "motion/react";

/** Shared spring presets so everything moves with the same physics. */
export const springs = {
  /** Panels, popovers: soft and settled. */
  gentle: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
  /** Chips, buttons: quick with a little bounce. */
  snappy: { type: "spring", stiffness: 500, damping: 28, mass: 0.6 },
  /** Layout reflow when items move. */
  layout: { type: "spring", stiffness: 380, damping: 32 },
} satisfies Record<string, Transition>;

export const fadeUp = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1 },
};
