"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPatient, type Patient, type PatientInput } from "@/lib/patients";
import type { Sex } from "@/lib/predict/types";
import { SEXES } from "@/lib/predict/schema";

const SEX_LABEL: Record<Sex, string> = { male: "Male", female: "Female", other: "Other" };

/** Small form for a new patient (also used on the Patients page). */
export function PatientForm({
  initial,
  submitLabel = "Add patient",
  onSubmit,
  onCancel,
}: {
  initial?: Partial<PatientInput>;
  submitLabel?: string;
  onSubmit: (p: PatientInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [birthYear, setBirthYear] = useState(initial?.birth_year ? String(initial.birth_year) : "");
  const [sex, setSex] = useState<Sex | "">(initial?.sex ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), year: useId(), sex: useId(), notes: useId() };
  const thisYear = new Date().getFullYear();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const year = birthYear ? Number(birthYear) : null;
    if (!name.trim()) return setError("Enter a name.");
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > thisYear)) return setError(`Birth year must be between 1900 and ${thisYear}.`);
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), birth_year: year, sex: sex || null, notes: notes.trim() || null });
    } catch (err) {
      setError((err as Error).message ?? "Couldn't save the patient.");
    } finally {
      setBusy(false);
    }
  };

  const field = "h-9 w-full rounded-full bg-fill px-3.5 text-sm text-text outline-none placeholder:text-muted focus-visible:outline-none focus:ring-2 focus:ring-[var(--accent)]";
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div>
        <label htmlFor={ids.name} className="label mb-1 block">
          Name
        </label>
        <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="off" placeholder="e.g. Alex Morgan" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={ids.year} className="label mb-1 block">
            Birth year
          </label>
          <input id={ids.year} value={birthYear} onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Optional" className={field} />
        </div>
        <div>
          <label htmlFor={ids.sex} className="label mb-1 block">
            Sex
          </label>
          <select id={ids.sex} value={sex} onChange={(e) => setSex(e.target.value as Sex | "")} className={`${field} appearance-none`}>
            <option value="">Not set</option>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {SEX_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={ids.notes} className="label mb-1 block">
          Notes
        </label>
        <input id={ids.notes} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Optional, e.g. allergies" className={field} />
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-contra/10 px-3 py-2 text-[13px] text-contra">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost !min-h-8 !px-3.5 !text-[13px]">
            Cancel
          </button>
        )}
        <button type="submit" disabled={busy} className="btn btn-primary !min-h-8 !px-3.5 !text-[13px]">
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

/**
 * "Patient" control for the app's top bar: choose who this analysis is for (or nobody),
 * or add a new patient inline. Signed-out users get a sign-in prompt instead.
 */
export function PatientPicker({
  signedIn,
  patients,
  value,
  onChange,
  onCreated,
}: {
  signedIn: boolean;
  patients: Patient[] | null;
  value: Patient | null;
  onChange: (p: Patient | null) => void;
  onCreated: (p: Patient) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!signedIn) {
    return (
      <Link href="/sign-in?next=/app" className="flex h-8 items-center gap-1.5 rounded-full bg-fill px-3 text-[13px] font-medium text-muted transition-colors hover:text-text">
        <PersonIcon /> Sign in to save patients
      </Link>
    );
  }

  const pick = (p: Patient | null) => {
    onChange(p);
    setOpen(false);
  };

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 max-w-56 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
          value ? "bg-cyan/15 text-text" : "bg-fill text-soft hover:text-text"
        }`}
      >
        <PersonIcon />
        <span className="truncate">{value ? value.name : "No patient"}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 opacity-60" aria-hidden>
          <path d="M2 3.5 5 6.5 8 3.5" />
        </svg>
      </button>
      {open && (
        <div id={panelId} role="dialog" aria-label="Choose a patient" className="hud-strong absolute top-full left-0 z-40 mt-2 w-72 p-2">
          {adding ? (
            <div className="p-2">
              <p className="mb-3 text-sm font-semibold">New patient</p>
              <PatientForm
                onCancel={() => setAdding(false)}
                onSubmit={async (input) => {
                  const p = await createPatient(input);
                  onCreated(p);
                  setAdding(false);
                  pick(p);
                }}
              />
            </div>
          ) : (
            <>
              <ul role="listbox" aria-label="Patients" className="max-h-64 overflow-y-auto">
                <li
                  role="option"
                  aria-selected={!value}
                  tabIndex={0}
                  onClick={() => pick(null)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(null))}
                  className={`cursor-pointer rounded-[10px] px-3 py-2 text-sm ${!value ? "bg-cyan/12 text-text" : "text-soft hover:bg-fill"}`}
                >
                  No patient
                  <span className="block text-xs text-muted">Results are saved to your history only</span>
                </li>
                {patients === null ? (
                  <li className="skeleton mx-1 my-1 h-9" aria-hidden />
                ) : (
                  patients.map((p) => (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={value?.id === p.id}
                      tabIndex={0}
                      onClick={() => pick(p)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(p))}
                      className={`cursor-pointer rounded-[10px] px-3 py-2 text-sm ${value?.id === p.id ? "bg-cyan/12 text-text" : "text-soft hover:bg-fill"}`}
                    >
                      {p.name}
                      <span className="block text-xs text-muted">
                        {[p.birth_year && `Born ${p.birth_year}`, p.sex && SEX_LABEL[p.sex]].filter(Boolean).join(" · ") || "No details"}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              <div className="mt-1 flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
                <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost !min-h-8 !px-3 !text-[13px]">
                  + New patient
                </button>
                <Link href="/patients" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-cyan hover:bg-fill">
                  Manage
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
