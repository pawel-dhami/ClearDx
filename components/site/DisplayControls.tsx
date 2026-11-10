"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_HUE, setHue, setTheme, useThemeState } from "@/lib/theme";

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
        className="grid size-9 place-items-center border border-line text-soft transition-colors hover:border-cyan hover:text-cyan"
      >
        {light ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={sliderId}
        aria-label="Accent colour"
        title="Accent colour"
        className="grid size-9 place-items-center border border-line transition-colors hover:border-cyan"
      >
        <span aria-hidden className="size-4 rounded-full bg-cyan shadow-[0_0_8px_var(--accent)]" />
      </button>
      {open && (
        <div className="hud-strong absolute top-full right-0 z-40 mt-2 w-64 p-4">
          <label htmlFor={sliderId} className="label mb-3 flex items-center justify-between">
            Accent colour <span className="text-cyan">{Math.round(hue)}°</span>
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
          <button type="button" onClick={() => setHue(DEFAULT_HUE)} className="btn btn-ghost mt-3 !min-h-8 w-full">
            Reset to cyan
          </button>
        </div>
      )}
    </div>
  );
}
