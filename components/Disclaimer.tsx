/**
 * Always-visible disclaimer. In normal document flow (never fixed over content).
 * Not dismissible.
 */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      aria-label="Medical disclaimer"
      className={`relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-amber bg-amber/5 px-3 py-2 text-[13px] text-text ${className}`}
    >
      <span className="font-mono text-[11px] font-bold tracking-[0.08em] text-amber">EDUCATIONAL DEMO</span>
      <span>
        Not medical advice. Predictions can be wrong. If you feel unwell or something seems urgent, contact a clinician
        or your local emergency number.
      </span>
    </p>
  );
}
