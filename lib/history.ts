"use client";

import type { FollowUpAnswer, PredictionResult, PredictorSource } from "./predict/types";
import { getSupabase } from "./supabase/client";

export interface SavedInput {
  symptoms: string[];
  age: number;
  sex: string;
  duration: string;
  answers: FollowUpAnswer[];
  excluded: string[];
  noEffect: string[];
}

export interface SavedAnalysis {
  id: string;
  created_at: string;
  source: PredictorSource;
  top_condition: string | null;
  top_confidence: number | null;
  input: SavedInput;
  result: PredictionResult;
  patient_id: string | null;
}

/** Saves one analysis for the signed-in user, optionally for a patient. Returns false when signed out / auth off. */
export async function saveAnalysis(source: PredictorSource, input: SavedInput, result: PredictionResult, patientId: string | null = null) {
  const sb = getSupabase();
  if (!sb) return false;
  const { data } = await sb.auth.getUser();
  if (!data.user) return false;
  const top = [...result.predictions].sort((a, b) => b.confidence - a.confidence)[0];
  const { error } = await sb.from("analyses").insert({
    source,
    top_condition: top?.condition ?? null,
    top_confidence: top?.confidence ?? null,
    input,
    result,
    patient_id: patientId,
  });
  if (error) throw error;
  return true;
}

/** Newest first; pass a patient id to list only that patient's reports. */
export async function listAnalyses(limit = 50, patientId?: string): Promise<SavedAnalysis[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let q = sb.from("analyses").select("*").order("created_at", { ascending: false }).limit(limit);
  if (patientId) q = q.eq("patient_id", patientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SavedAnalysis[];
}

export async function deleteAnalysis(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("analyses").delete().eq("id", id);
  if (error) throw error;
}

/** Links a saved analysis to a patient (or unlinks it with null). */
export async function assignAnalysis(id: string, patientId: string | null) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("analyses").update({ patient_id: patientId }).eq("id", id);
  if (error) throw error;
}
