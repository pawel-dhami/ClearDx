"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { REGION_LABELS, SYMPTOMS } from "@/lib/symptoms";

const MAX_RESULTS = 6;
const CUSTOM_MAX = 100;

interface Option {
  label: string;
  hint: string;
  custom?: boolean;
}

/**
 * Type-to-add search across every symptom (any region), using the ARIA combobox
 * pattern: arrow keys move, Enter adds, Escape clears. Anything not in the catalog
 * can be added in the user's own words.
 */
export function SymptomSearch({ selected, onAdd }: { selected: string[]; onAdd: (label: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const taken = new Set(selected.map((s) => s.toLowerCase()));
    const words = q.split(/\s+/);
    const matches = SYMPTOMS.filter((s) => !taken.has(s.label.toLowerCase()))
      .map((s) => {
        const text = `${s.label} ${REGION_LABELS[s.region]}`.toLowerCase();
        if (!words.every((w) => text.includes(w))) return null;
        // label prefix matches first, then word starts, then anywhere
        const l = s.label.toLowerCase();
        const score = l.startsWith(q) ? 0 : l.split(/\W+/).some((w) => w.startsWith(words[0])) ? 1 : 2;
        return { s, score };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.score - b.score || a.s.label.localeCompare(b.s.label))
      .slice(0, MAX_RESULTS)
      .map(({ s }): Option => ({ label: s.label, hint: REGION_LABELS[s.region] }));
    const exact = SYMPTOMS.some((s) => s.label.toLowerCase() === q) || taken.has(q);
    if (!exact) {
      const own = query.trim().slice(0, CUSTOM_MAX);
      matches.push({ label: own[0].toUpperCase() + own.slice(1), hint: "Add in your own words", custom: true });
    }
    return matches;
  }, [query, selected]);

  const add = (o: Option | undefined) => {
    if (!o) return;
    onAdd(o.label);
    setQuery("");
    setActive(0);
    input.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!options.length) return;
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter") {
      if (!open || !options.length) return;
      e.preventDefault();
      add(options[active]);
    } else if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        e.stopPropagation();
        setQuery("");
      }
      setOpen(false);
    }
  };

  const showList = open && options.length > 0;
  return (
    <div className="relative">
      <div className="flex h-8 items-center gap-2 rounded-full bg-fill pr-1 pl-3 transition-shadow focus-within:ring-2 focus-within:ring-[var(--accent)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-label="Search symptoms"
          placeholder="Search symptoms"
          value={query}
          maxLength={CUSTOM_MAX}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted focus-visible:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--fill-hover)] text-muted hover:text-text"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M1 1l8 8M9 1L1 9" />
            </svg>
          </button>
        )}
      </div>
      {showList && (
        <ul id={listId} role="listbox" aria-label="Matching symptoms" className="hud-strong absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto p-1.5">
          {options.map((o, i) => (
            <li
              key={`${o.custom ? "custom:" : ""}${o.label}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // keep focus in the input so typing continues
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(o)}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-sm ${i === active ? "bg-cyan/12 text-text" : "text-soft"}`}
            >
              <span className="min-w-0 truncate">{o.custom ? <>Add “{o.label}”</> : o.label}</span>
              <span className={`shrink-0 text-xs ${o.custom ? "text-cyan" : "text-muted"}`}>{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
