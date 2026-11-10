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
}

/** Saves one analysis for the signed-in user. Returns false when signed out / auth off. */
export async function saveAnalysis(source: PredictorSource, input: SavedInput, result: PredictionResult) {
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
  });
  if (error) throw error;
  return true;
}

export async function listAnalyses(limit = 50): Promise<SavedAnalysis[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("analyses").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as SavedAnalysis[];
}

export async function deleteAnalysis(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("analyses").delete().eq("id", id);
  if (error) throw error;
}
