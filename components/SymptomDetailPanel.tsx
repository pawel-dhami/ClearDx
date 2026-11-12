"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { partLabel, partsForSymptom, symptomHasSides } from "@/components/body-map/parts";
import {
  DETAIL_LABELS,
  hasDetail,
  NOTE_MAX,
  ONSET_OPTIONS,
  PATTERN_OPTIONS,
  SEVERITY_OPTIONS,
  SIDE_OPTIONS,
  type SymptomDetail,
} from "@/lib/symptomDetail";

/**
 * Pill choices with the radio pattern (one tab stop, arrow keys move). Every
 * field is optional, so choosing the selected pill again clears it.
 */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value?: T;
  onChange: (v: T | undefined) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const id = useId();
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = value ? options.indexOf(value) : -1;
    const next = options[(i + step + options.length) % options.length];
    onChange(next);
    group.current?.querySelectorAll<HTMLButtonElement>("[role=radio]")[options.indexOf(next)]?.focus();
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span id={id} className="w-16 shrink-0 text-xs font-medium text-muted">
        {label}
      </span>
      <div ref={group} role="radiogroup" aria-labelledby={id} onKeyDown={onKeyDown} className="flex flex-wrap gap-1">
        {options.map((o, i) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (!value && i === 0) ? 0 : -1}
              onClick={() => onChange(on ? undefined : o)}
              className={`min-h-7 rounded-full px-2.5 text-xs font-medium transition-colors ${
                on ? "bg-[var(--accent-fill)] text-white" : "bg-raised text-soft ring-1 ring-[var(--line)] hover:text-text"
              }`}
            >
              {DETAIL_LABELS[o]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Optional detail for one symptom; changes apply immediately. */
export function SymptomDetailPanel({
  label,
  detail,
  onChange,
  onDone,
}: {
  label: string;
  detail: SymptomDetail;
  onChange: (d: SymptomDetail) => void;
  onDone: () => void;
}) {
  const first = useRef<HTMLDivElement>(null);
  const noteId = useId();
  const set = <K extends keyof SymptomDetail>(k: K, v: SymptomDetail[K]) => onChange({ ...detail, [k]: v });
  const sided = symptomHasSides(label);
  const affects = partsForSymptom(label, detail.side).map(partLabel);

  // Move focus into the panel when it opens.
  useEffect(() => {
    first.current?.querySelector<HTMLButtonElement>("[role=radio][tabindex='0']")?.focus();
  }, []);

  return (
    <div
      ref={first}
      className="mx-1 mt-1 mb-1.5 space-y-2.5 rounded-xl bg-raised p-3 ring-1 ring-[var(--line)]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
    >
      <Choice label="Severity" options={SEVERITY_OPTIONS} value={detail.severity} onChange={(v) => set("severity", v)} />
      <Choice label="Onset" options={ONSET_OPTIONS} value={detail.onset} onChange={(v) => set("onset", v)} />
      <Choice label="Pattern" options={PATTERN_OPTIONS} value={detail.pattern} onChange={(v) => set("pattern", v)} />
      {sided && <Choice label="Side" options={SIDE_OPTIONS} value={detail.side} onChange={(v) => set("side", v)} />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label htmlFor={noteId} className="w-16 shrink-0 text-xs font-medium text-muted">
          Note
        </label>
        <input
          id={noteId}
          type="text"
          maxLength={NOTE_MAX}
          value={detail.note ?? ""}
          onChange={(e) => set("note", e.target.value || undefined)}
          placeholder="e.g. worse at night, after meals"
          className="h-8 min-w-0 flex-1 rounded-full bg-fill px-3 text-[13px] text-text outline-none placeholder:text-muted focus-visible:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>
      {affects.length > 0 && (
        <p className="text-xs text-muted">
          <span className="font-medium text-complement">●</span> Lights on the body: {affects.join(", ")}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 pt-0.5">
        {hasDetail(detail) && (
          <button type="button" onClick={() => onChange({})} className="rounded-full px-3 py-1 text-xs font-medium text-muted hover:bg-fill hover:text-text">
            Clear
          </button>
        )}
        <button type="button" onClick={onDone} className="btn btn-primary !min-h-7 !px-3.5 !text-xs">
          Done
        </button>
      </div>
    </div>
  );
}
