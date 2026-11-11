"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { springs } from "@/lib/motion";

const CHARS_PER_SECOND = 95;
const PAUSE_BETWEEN_STEPS_MS = 260;

interface ReasoningTimelineProps {
  steps: string[];
  /** Index of the selected step (its references are highlighted elsewhere). */
  selected: number | null;
  onSelect: (index: number | null) => void;
}

/**
 * Steps reveal one at a time with a typewriter effect; each finished step is a
 * button that highlights the symptoms and conditions it mentions.
 * Parent passes `key={steps.join()}` so a new result restarts the reveal.
 * Screen readers get the full text immediately via an sr-only list.
 */
export function ReasoningTimeline({ steps, selected, onSelect }: ReasoningTimelineProps) {
  const reduced = useReducedMotion();
  const pause = (PAUSE_BETWEEN_STEPS_MS / 1000) * CHARS_PER_SECOND;
  const total = steps.reduce((a, s) => a + s.length + pause, 0);
  const [progress, setProgress] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const done = reduced || skipped || progress >= total;

  useEffect(() => {
    if (done) return;
    let raf = 0;
    const start = performance.now();
    const loop = (t: number) => {
      const p = ((t - start) / 1000) * CHARS_PER_SECOND;
      setProgress(p);
      if (p < total) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [done, total]);

  // Characters visible per step (-1 = not started yet).
  const visible: number[] = [];
  for (let i = 0, budget = done ? Infinity : progress; i < steps.length; i++) {
    visible.push(budget <= 0 ? -1 : Math.min(steps[i].length, Math.floor(budget)));
    budget -= steps[i].length + pause;
  }
  const typingIndex = done ? -1 : visible.findIndex((v, i) => v >= 0 && v < steps[i].length);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol className="sr-only">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <ol aria-label="Reasoning steps (click one to highlight what it refers to)" className="min-h-0 flex-1 space-y-0.5 overflow-auto pr-1">
        {steps.map((s, i) => {
          const shown = visible[i];
          if (shown < 0) return null;
          const typing = i === typingIndex;
          const complete = shown >= s.length;
          const on = selected === i;
          return (
            <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={springs.gentle}>
              <button
                type="button"
                disabled={!complete}
                aria-pressed={on}
                aria-label={s}
                onClick={() => onSelect(on ? null : i)}
                className={`flex w-full gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] leading-snug transition-colors ${
                  on ? "bg-cyan/12 text-text" : "text-soft hover:bg-fill hover:text-text"
                }`}
              >
                <span aria-hidden className={`mt-px grid size-[18px] shrink-0 place-items-center rounded-full text-[10px] font-semibold ${on ? "bg-[var(--accent-fill)] text-white" : "bg-fill text-muted"}`}>
                  {i + 1}
                </span>
                <span aria-hidden>
                  {s.slice(0, shown)}
                  {typing && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-blink bg-cyan" />}
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>
      {!done && (
        <button type="button" onClick={() => setSkipped(true)} className="mt-2 self-start rounded-full px-2.5 py-1 text-[13px] font-medium text-cyan hover:bg-fill">
          Show all steps
        </button>
      )}
    </div>
  );
}
