/**
 * Supabase settings come from public env vars (safe to expose: access is enforced
 * by row-level security). When they're missing, auth is simply turned off and the
 * app behaves exactly as before: no Sign in button, no history.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const authEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null | undefined, fallback = "/app") {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
