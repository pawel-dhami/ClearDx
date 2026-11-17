/** Supabase returns plain error objects, which log as "{}". Wrap them so the message and code show up. */
export function dbError(e: { message: string; code?: string | null; details?: string | null }): Error {
  return new Error(`${e.message}${e.code ? ` (${e.code})` : ""}${e.details ? ` — ${e.details}` : ""}`);
}
