"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";

/** Current Supabase user (null when signed out or auth is off); `ready` once the first check finishes. */
export function useSession() {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: !getSupabase() });
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    sb.auth.getUser().then(({ data }) => alive && setState({ user: data.user, ready: true }));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setState({ user: session?.user ?? null, ready: true }));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}
