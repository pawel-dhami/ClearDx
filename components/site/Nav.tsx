import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "./AccountMenu";
import { DisplayControls } from "./DisplayControls";
import { LogoMark } from "./Hud";

/**
 * Shared minimal top nav: logo · "How it works" · right-hand slot.
 * The landing page passes "Launch app"; the app passes its mode badge.
 */
export function Nav({ right, compact = false }: { right?: ReactNode; compact?: boolean }) {
  return (
    <header className={`relative z-20 ${compact ? "w-full px-3 pt-3 lg:px-6" : "mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-8 sm:pt-6"}`}>
      <nav aria-label="Main" className={`hud flex items-center justify-between gap-4 !rounded-full pr-2 pl-4 ${compact ? "h-12" : "h-14 sm:pl-5"}`}>
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-text" aria-label="ClearDx home">
            <LogoMark size={compact ? 20 : 24} />
            <span className={`font-display font-semibold ${compact ? "text-[17px]" : "text-lg"}`}>ClearDx</span>
          </Link>
          <Link href="/#how-it-works" className="hidden rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-fill hover:text-text sm:inline">
            How it works
          </Link>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <DisplayControls />
          {right}
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}
