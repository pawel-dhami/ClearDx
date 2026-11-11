import type { ReactNode } from "react";

/** Section title, e.g. "Top match". */
export function PanelTitle({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`text-[15px] font-semibold tracking-tight text-text ${className}`}>
      {children}
    </h2>
  );
}

/** ClearDx mark: a rounded tile with a soft pulse line. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--accent-fill)" />
      <path d="M5 12.5h3.2l1.8-4 3.6 8 1.8-4H19" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
