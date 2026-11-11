"use client";

import { useRef, type KeyboardEvent } from "react";
import { DURATIONS, DURATION_LABELS, SEXES } from "@/lib/predict/schema";
import type { Duration, Sex } from "@/lib/predict/types";

const SEX_LABEL: Record<Sex, string> = { male: "M", female: "F", other: "Other" };
const DURATION_SHORT: Record<Duration, string> = { "<24h": "<24h", "1-3d": "1–3d", "4-7d": "4–7d", "1-4w": "1–4w", ">1m": ">1mo" };

/** Segmented control with the ARIA radio pattern (one tab stop, arrow keys move + select). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
  describe,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
  describe?: (v: T) => string;
}) {
  const group = useRef<HTMLDivElement>(null);
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
    <div ref={group} role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex rounded-full bg-fill p-0.5">
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={describe?.(o)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o)}
            className={`min-h-7 rounded-full px-3 text-[13px] font-medium transition-all ${
              on ? "bg-raised text-text shadow-[0_1px_3px_rgb(0_0_0/0.18)]" : "text-muted hover:text-text"
            }`}
          >
            {render(o)}
          </button>
        );
      })}
    </div>
  );
}

interface AboutStripProps {
  age: number;
  sex: Sex;
  duration: Duration;
  onAge: (n: number) => void;
  onSex: (s: Sex) => void;
  onDuration: (d: Duration) => void;
  children?: React.ReactNode;
}

/** Compact "About you" strip: age stepper, sex, duration; right-hand slot for controls. */
export function AboutStrip({ age, sex, duration, onAge, onSex, onDuration, children }: AboutStripProps) {
  const clamp = (n: number) => Math.max(0, Math.min(120, Math.round(n) || 0));
  return (
    <section aria-label="About you and controls" className="flex flex-wrap items-center gap-x-5 gap-y-2.5 py-1">
      <span className="text-[13px] font-semibold text-text">About you</span>
      <div className="flex items-center gap-2">
        <label htmlFor="age" className="label">
          Age
        </label>
        <div className="flex items-center rounded-full bg-fill p-0.5">
          <button type="button" onClick={() => onAge(clamp(age - 1))} aria-label="Decrease age" className="grid size-7 place-items-center rounded-full text-soft hover:bg-raised hover:text-text">
            −
          </button>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={age}
            onChange={(e) => onAge(clamp(Number(e.target.value)))}
            className="w-10 bg-transparent text-center font-mono text-sm font-medium text-text [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" onClick={() => onAge(clamp(age + 1))} aria-label="Increase age" className="grid size-7 place-items-center rounded-full text-soft hover:bg-raised hover:text-text">
            +
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="label" id="sex-label">
          Sex
        </span>
        <Segmented label="Sex" options={SEXES} value={sex} onChange={onSex} render={(s) => SEX_LABEL[s]} describe={(s) => s} />
      </div>
      <div className="flex items-center gap-2">
        <span className="label">Duration</span>
        <Segmented label="Symptom duration" options={DURATIONS} value={duration} onChange={onDuration} render={(d) => DURATION_SHORT[d]} describe={(d) => DURATION_LABELS[d]} />
      </div>
      <div className="ml-auto flex items-center gap-3">{children}</div>
    </section>
  );
}

export function WhatIfSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-8 items-center gap-2.5">
      <span className="label">What-if</span>
      <span className={`relative h-[22px] w-[38px] rounded-full transition-colors ${on ? "bg-[var(--accent-fill)]" : "bg-[var(--line-strong)]"}`}>
        <span className={`absolute top-[2px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)] transition-all ${on ? "left-[18px]" : "left-[2px]"}`} />
      </span>
    </button>
  );
}
