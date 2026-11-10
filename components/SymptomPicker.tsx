"use client";

import { motion } from "motion/react";
import { useEffect, useEffectEvent, useRef } from "react";
import { springs } from "@/lib/motion";
import { REGION_LABELS, symptomsInRegion, type Region } from "@/lib/symptoms";

interface SymptomPickerProps {
  region: Region;
  selected: string[];
  onToggle: (label: string) => void;
  onClose: () => void;
}

/** Popover listing the symptoms for one body region as toggle pills. */
export function SymptomPicker({ region, selected, onToggle, onClose }: SymptomPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const options = symptomsInRegion(region);

  const opener = useRef<HTMLElement | null>(null);
  // Hand focus back to whatever opened the picker *before* closing, so it never sits in the exiting dialog.
  const closeAndRestore = () => {
    const el = opener.current;
    if (el && el !== document.body && document.contains(el)) el.focus({ preventScroll: true });
    onClose();
  };
  const close = useEffectEvent(closeAndRestore);

  useEffect(() => {
    // Move focus into the picker on open, remembering what opened it.
    // Only on the first run: Strict Mode re-runs this effect after focus has already moved inside.
    if (!opener.current && document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    ref.current?.querySelector<HTMLButtonElement>("[data-option]")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={`${REGION_LABELS[region]} symptoms`}
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={springs.gentle}
      className="hud-strong absolute inset-x-3 bottom-3 z-20 max-h-[80%] overflow-y-auto overscroll-contain p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-baseline gap-3">
          <span className="font-display text-lg font-bold tracking-[0.06em] text-cyan uppercase">{REGION_LABELS[region]}</span>
          <span className="label">Select all that apply</span>
        </h3>
        <motion.button
          onClick={closeAndRestore}
          whileTap={{ scale: 0.9 }}
          aria-label="Close symptom picker"
          className="grid size-8 place-items-center border border-line text-muted hover:border-cyan hover:text-cyan"
        >
          ✕
        </motion.button>
      </div>
      <motion.ul
        className="flex flex-wrap gap-1.5"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.025 } } }}
      >
        {options.map((s) => {
          const on = selected.includes(s.label);
          return (
            <motion.li
              key={s.id}
              variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
              transition={springs.snappy}
            >
              <motion.button
                data-option
                onClick={() => onToggle(s.label)}
                aria-pressed={on}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
                className={`flex min-h-9 items-center gap-1.5 rounded-[2px] border px-3 text-sm transition-colors ${
                  on
                    ? "border-cyan bg-cyan/12 text-text shadow-[0_0_12px_color-mix(in_oklab,var(--accent)_30%,transparent)]"
                    : "border-line text-soft hover:border-cyan hover:text-text"
                }`}
              >
                <motion.span
                  aria-hidden
                  initial={false}
                  animate={{ scale: on ? 1 : 0, width: on ? 12 : 0 }}
                  transition={springs.snappy}
                  className="overflow-hidden text-cyan"
                >
                  ✓
                </motion.span>
                {s.label}
              </motion.button>
            </motion.li>
          );
        })}
      </motion.ul>
    </motion.div>
  );
}
