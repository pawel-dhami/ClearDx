/**
 * Always-visible disclaimer. In normal document flow (never fixed over content).
 * Not dismissible.
 */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      aria-label="Medical disclaimer"
      className={`relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-amber/10 px-4 py-2 text-[13px] text-soft ${className}`}
    >
      <span className="font-semibold text-amber">Educational demo</span>
      <span>
        Not medical advice. Predictions can be wrong. If you feel unwell or something seems urgent, contact a clinician
        or your local emergency number.
      </span>
    </p>
  );
}
