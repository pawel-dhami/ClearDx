import { NextResponse } from "next/server";
import { authEnabled, safeNext } from "@/lib/supabase/config";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Landing point for both the emailed magic link and the Google redirect:
 * exchanges the one-time code for a session cookie, then goes back to the app.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  if (!authEnabled || !code) return NextResponse.redirect(new URL(`/sign-in?error=link`, url.origin));

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/sign-in?error=expired`, url.origin));
  return NextResponse.redirect(new URL(next, url.origin));
}
