"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { springs } from "@/lib/motion";

const CHARS_PER_SECOND = 95;
const PAUSE_BETWEEN_STEPS_MS = 260;

/**
 * Steps reveal one at a time with a typewriter effect.
 * Parent should pass `key={steps.join()}` so a new result restarts the animation.
 * Screen readers get the full text immediately via an sr-only list.
 */
export function ReasoningTimeline({ steps }: { steps: string[] }) {
  const reduced = useReducedMotion();
  // Progress is measured in "virtual characters": each step's length plus a pause.
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

  // Work out how much of each step is visible.
  let budget = done ? Infinity : progress;
  const visible = steps.map((s) => {
    if (budget <= 0) return -1; // not started
    const shown = Math.min(s.length, Math.floor(budget));
    budget -= s.length + pause;
    return shown;
  });
  const typingIndex = done ? -1 : visible.findIndex((v, i) => v >= 0 && v < steps[i].length);

  return (
    <div>
      <ol className="sr-only">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <ol aria-hidden className="relative space-y-3">
        {/* spine that grows as steps appear */}
        <motion.div
          className="absolute top-2 left-[7px] w-px origin-top bg-gradient-to-b from-neon-violet/70 to-neon-cyan/30"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: Math.max(0, visible.filter((v) => v >= 0).length - 1) / Math.max(1, steps.length - 1) }}
          transition={springs.gentle}
          style={{ height: "calc(100% - 1.25rem)" }}
        />
        {steps.map((s, i) => {
          const shown = visible[i];
          if (shown < 0) return null;
          const typing = i === typingIndex;
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={springs.gentle}
              className="relative flex gap-3"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={springs.snappy}
                className={`relative z-10 mt-1 grid size-[15px] shrink-0 place-items-center rounded-full border text-[8px] font-semibold ${
                  typing
                    ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan shadow-[0_0_10px_#5eead4]"
                    : "border-neon-violet/60 bg-ink text-neon-violet"
                }`}
              >
                {i + 1}
              </motion.span>
              <p className="text-sm leading-relaxed text-text/90">
                {s.slice(0, shown)}
                {typing && (
                  <motion.span
                    className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-neon-cyan"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                )}
              </p>
            </motion.li>
          );
        })}
      </ol>

      {!done && (
        <button onClick={() => setSkipped(true)} className="mt-3 text-xs text-muted hover:text-neon-cyan">
          Show all steps
        </button>
      )}
    </div>
  );
}
