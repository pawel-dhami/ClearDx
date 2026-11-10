import type { ReactNode } from "react";

/** The four 8×8 corner brackets that mark a HUD panel. */
export function Corners({ tone = "cyan", only }: { tone?: "cyan" | "contra" | "amber"; only?: ("tl" | "tr" | "bl" | "br")[] }) {
  const color = { cyan: "border-cyan", contra: "border-contra", amber: "border-amber" }[tone];
  const all = only ?? ["tl", "tr", "bl", "br"];
  const pos = {
    tl: "-top-0.5 -left-0.5 border-t-2 border-l-2",
    tr: "-top-0.5 -right-0.5 border-t-2 border-r-2",
    bl: "-bottom-0.5 -left-0.5 border-b-2 border-l-2",
    br: "-bottom-0.5 -right-0.5 border-b-2 border-r-2",
  };
  return (
    <>
      {all.map((c) => (
        <span key={c} aria-hidden className={`pointer-events-none absolute z-10 size-2 ${color} ${pos[c]}`} />
      ))}
    </>
  );
}

/** Mono section title with a glowing square marker, e.g. "■ TOP MATCH". */
export function PanelTitle({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`flex items-center gap-2 font-mono text-xs tracking-[0.1em] text-muted uppercase ${className}`}>
      <span aria-hidden className="size-1.5 bg-cyan shadow-[0_0_6px_var(--color-cyan)]" />
      {children}
    </h2>
  );
}

/** ClearDx pulse-line mark. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12h4l2-5 4 10 2-5h6" strokeLinecap="square" />
    </svg>
  );
}
