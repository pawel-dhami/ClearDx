"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Sex } from "./predict/types";
import { getSupabase } from "./supabase/client";

/** A patient kept by the signed-in user (table public.patients, protected by row-level security). */
export interface Patient {
  id: string;
  created_at: string;
  name: string;
  birth_year: number | null;
  sex: Sex | null;
  notes: string | null;
}

export type PatientInput = Pick<Patient, "name" | "birth_year" | "sex" | "notes">;

const clean = (p: Partial<PatientInput>) => ({
  ...(p.name !== undefined && { name: p.name.trim().slice(0, 80) }),
  ...(p.birth_year !== undefined && { birth_year: p.birth_year }),
  ...(p.sex !== undefined && { sex: p.sex }),
  ...(p.notes !== undefined && { notes: p.notes?.trim().slice(0, 500) || null }),
});

export async function listPatients(): Promise<Patient[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("patients").select("id, created_at, name, birth_year, sex, notes").order("name");
  if (error) throw error;
  return (data ?? []) as Patient[];
}

export async function createPatient(p: PatientInput): Promise<Patient> {
  const sb = getSupabase();
  if (!sb) throw new Error("Sign-in isn't set up on this deployment.");
  const { data, error } = await sb.from("patients").insert(clean(p)).select().single();
  if (error) throw error;
  return data as Patient;
}

export async function updatePatient(id: string, p: Partial<PatientInput>): Promise<Patient> {
  const sb = getSupabase();
  if (!sb) throw new Error("Sign-in isn't set up on this deployment.");
  const { data, error } = await sb.from("patients").update(clean(p)).eq("id", id).select().single();
  if (error) throw error;
  return data as Patient;
}

/** Deletes the patient; their saved reports stay in History, unlinked. */
export async function deletePatient(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("patients").delete().eq("id", id);
  if (error) throw error;
}

/** Age this year from a birth year (null when unknown). */
export const ageFrom = (birthYear: number | null) => (birthYear ? Math.max(0, new Date().getFullYear() - birthYear) : null);

/** Patients for the signed-in user, with a reload function. `null` while loading. `onLoad` runs once with the first list. */
export function usePatients(enabled: boolean, onLoad?: (rows: Patient[]) => void) {
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  });
  const reload = useCallback(async () => {
    try {
      setPatients(await listPatients());
      setError(null);
    } catch (e) {
      setError((e as Error).message ?? "Couldn't load patients.");
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    listPatients()
      .then((rows) => {
        if (!alive) return;
        setPatients(rows);
        onLoadRef.current?.(rows);
      })
      .catch((e) => alive && setError(e.message ?? "Couldn't load patients."));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { patients, setPatients, error, reload };
}
