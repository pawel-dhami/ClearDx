"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { authEnabled } from "@/lib/supabase/config";
import { useSession } from "@/lib/useSession";

/** "Sign in" when signed out, avatar menu (History, Sign out) when signed in. Renders nothing if auth isn't configured. */
export function AccountMenu() {
  const { user, ready } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!authEnabled || !ready) return null;
  if (!user) {
    if (pathname === "/sign-in") return null;
    return (
      <Link href={`/sign-in?next=${encodeURIComponent(pathname === "/" ? "/app" : pathname)}`} className="btn btn-ghost">
        Sign in
      </Link>
    );
  }

  const email = user.email ?? "Account";
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${email}`}
        className="flex h-9 items-center gap-2 border border-cyan/25 pr-3 pl-1 hover:border-cyan"
      >
        <span className="grid size-7 place-items-center rounded-full bg-cyan/15 font-mono text-xs text-cyan">{initials}</span>
        <span className="hidden max-w-36 truncate font-mono text-xs text-soft sm:inline">{email}</span>
      </button>
      {open && (
        <div role="menu" className="hud-strong absolute top-full right-0 z-40 mt-2 w-48 p-1">
          <Link role="menuitem" href="/history" onClick={() => setOpen(false)} className="block px-3 py-2 font-mono text-xs uppercase hover:bg-cyan/8 hover:text-cyan">
            History
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={async () => {
              setOpen(false);
              await getSupabase()?.auth.signOut();
            }}
            className="block w-full px-3 py-2 text-left font-mono text-xs uppercase hover:bg-cyan/8 hover:text-contra"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
