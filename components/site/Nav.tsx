import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "./AccountMenu";
import { Corners, LogoMark } from "./Hud";

/**
 * Shared minimal top nav: logo · "How it works" · right-hand slot.
 * The landing page passes "Launch app"; the app passes its mode badge.
 */
export function Nav({ right, compact = false }: { right?: ReactNode; compact?: boolean }) {
  return (
    <header className={`relative z-20 ${compact ? "w-full px-3 pt-3 lg:px-6" : "mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-8 sm:pt-6"}`}>
      <nav aria-label="Main" className={`hud flex items-center justify-between gap-4 px-4 ${compact ? "h-12" : "h-14 sm:px-6"}`}>
        <Corners />
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 text-cyan" aria-label="ClearDx home">
            <LogoMark size={compact ? 20 : 24} />
            <span className={`font-display font-bold tracking-[0.18em] uppercase glow ${compact ? "text-xl" : "text-2xl"}`}>ClearDx</span>
          </Link>
          <Link href="/#how-it-works" className="hidden font-mono text-xs text-muted hover:text-cyan sm:inline">
            [ HOW IT WORKS ]
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {right}
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}
