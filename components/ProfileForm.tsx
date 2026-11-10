"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";
import { springs } from "@/lib/motion";
import { DURATIONS, DURATION_LABELS, SEXES } from "@/lib/predict/schema";
import type { Duration, Sex } from "@/lib/predict/types";

interface ProfileFormProps {
  age: number;
  sex: Sex;
  duration: Duration;
  onAge: (n: number) => void;
  onSex: (s: Sex) => void;
  onDuration: (d: Duration) => void;
}

const SHORT_DURATION: Record<Duration, string> = {
  "<24h": "< 24h",
  "1-3d": "1–3 d",
  "4-7d": "4–7 d",
  "1-4w": "1–4 wk",
  ">1m": "> 1 mo",
};

function Segmented<T extends string>({
  name,
  options,
  value,
  onChange,
  render,
  label,
}: {
  name: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
  label: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  // ARIA radio pattern: one tab stop; arrow keys move (and select) within the group.
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const i = options.indexOf(value);
    let next = step ? (i + step + options.length) % options.length : -1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next]);
    group.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[next]?.focus();
  };
  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-wrap gap-1 rounded-2xl border border-line bg-black/20 p-1"
    >
      {options.map((o) => {
        const on = o === value;
        return (
          <motion.button
            key={o}
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            onClick={() => onChange(o)}
            className="relative min-h-8 flex-1 rounded-xl px-2.5 py-1.5 text-xs whitespace-nowrap sm:text-sm"
          >
            {on && (
              <motion.span
                layoutId={`seg-${name}`}
                transition={springs.snappy}
                className="absolute inset-0 rounded-xl border border-neon-cyan/40 bg-neon-cyan/12 shadow-[0_0_18px_-6px_rgba(94,234,212,.7)]"
              />
            )}
            <span className={`relative ${on ? "text-text" : "text-muted"}`}>{render(o)}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function ProfileForm({ age, sex, duration, onAge, onSex, onDuration }: ProfileFormProps) {
  const ageId = useId();
  const pct = (age / 100) * 100;
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label htmlFor={ageId} className="text-xs text-muted">
            Age
          </label>
          <motion.span
            key={age}
            initial={{ y: -4, opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            transition={springs.snappy}
            className="font-mono text-lg text-text tabular-nums"
          >
            {age}
          </motion.span>
        </div>
        <input
          id={ageId}
          type="range"
          min={0}
          max={100}
          value={Math.min(age, 100)}
          onChange={(e) => onAge(Number(e.target.value))}
          aria-valuetext={`${age} years`}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-neon-cyan"
          style={{
            background: `linear-gradient(90deg, #5eead4 0%, #a78bfa ${pct}%, rgba(255,255,255,.08) ${pct}%)`,
          }}
        />
      </div>
      <div className="space-y-2">
        <span className="text-xs text-muted">Sex</span>
        <Segmented name="sex" label="Sex" options={SEXES} value={sex} onChange={onSex} render={(s) => s[0].toUpperCase() + s.slice(1)} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <span className="text-xs text-muted">How long have you had symptoms?</span>
        <Segmented
          name="duration"
          label="Duration"
          options={DURATIONS}
          value={duration}
          onChange={onDuration}
          render={(d) => SHORT_DURATION[d]}
        />
        <span className="sr-only">{DURATION_LABELS[duration]}</span>
      </div>
    </div>
  );
}
