"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { DEFAULT_HUE, setHue, setTheme, useThemeState } from "@/lib/theme";

const MORPH = { type: "spring", stiffness: 260, damping: 22 } as const;

/**
 * One icon that morphs between a sun and a crescent moon: the disc grows, a
 * masking circle slides in to carve the crescent, and the rays spin and retract.
 */
function SunMoon({ moon }: { moon: boolean }) {
  const mask = useId();
  return (
    <motion.svg width="18" height="18" viewBox="0 0 24 24" aria-hidden initial={false} animate={{ rotate: moon ? -30 : 0 }} transition={MORPH}>
      <mask id={mask}>
        <rect width="24" height="24" fill="#fff" />
        <motion.circle r="7.5" fill="#000" initial={false} animate={moon ? { cx: 16.5, cy: 7.5 } : { cx: 30, cy: -6 }} transition={MORPH} />
      </mask>
      <motion.circle cx="12" cy="12" fill="currentColor" mask={`url(#${mask})`} initial={false} animate={{ r: moon ? 8.5 : 4.5 }} transition={MORPH} />
      <motion.g
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        style={{ originX: "12px", originY: "12px" }}
        initial={false}
        animate={moon ? { scale: 0.3, rotate: -90, opacity: 0 } : { scale: 1, rotate: 0, opacity: 1 }}
        transition={MORPH}
      >
        <path d="M12 1.8v2.4M12 19.8v2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M1.8 12h2.4M19.8 12h2.4M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7" />
      </motion.g>
    </motion.svg>
  );
}

/** Theme toggle (dark/light) + accent colour slider, saved per browser. */
export function DisplayControls() {
  const { theme, hue } = useThemeState();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const sliderId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const light = theme === "light";
  return (
    <div ref={wrap} className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => setTheme(light ? "dark" : "light")}
        aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
        title={light ? "Dark theme" : "Light theme"}
        className="grid size-9 place-items-center rounded-full text-soft transition-colors hover:bg-fill hover:text-text"
      >
        {/* In light mode the button offers "dark", so it shows the moon. */}
        <SunMoon moon={light} />
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={sliderId}
        aria-label="Accent colour"
        title="Accent colour"
        className="grid size-9 place-items-center rounded-full transition-colors hover:bg-fill"
      >
        <span aria-hidden className="size-[18px] rounded-full bg-[var(--accent-fill)] ring-2 ring-[var(--line-strong)]" />
      </button>
      {open && (
        <div className="hud-strong absolute top-full right-0 z-40 mt-2 w-64 p-4">
          <label htmlFor={sliderId} className="mb-3 flex items-center justify-between text-sm font-semibold">
            Accent colour <span className="font-mono font-normal text-muted">{Math.round(hue)}°</span>
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={360}
            step={1}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            aria-valuetext={`Hue ${Math.round(hue)} degrees`}
            className="h-2 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: "linear-gradient(90deg, oklch(0.75 0.15 0), oklch(0.75 0.15 60), oklch(0.75 0.15 120), oklch(0.75 0.15 180), oklch(0.75 0.15 240), oklch(0.75 0.15 300), oklch(0.75 0.15 360))",
              accentColor: "var(--accent)",
            }}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-soft">Green and red stay fixed so evidence colours keep their meaning.</span>
          </div>
          <button type="button" onClick={() => setHue(DEFAULT_HUE)} className="btn btn-ghost mt-3 !min-h-9 w-full">
            Reset to blue
          </button>
        </div>
      )}
    </div>
  );
}
