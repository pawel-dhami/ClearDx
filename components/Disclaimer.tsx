/** Persistent, always-visible disclaimer. Deliberately not dismissible. */
export function Disclaimer() {
  return (
    <div
      role="note"
      aria-label="Medical disclaimer"
      className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-3"
    >
      <div className="glass-strong mx-auto flex max-w-7xl items-center gap-3 rounded-2xl border-warn/30! px-3 py-2 text-xs text-amber-100 sm:px-4 sm:py-2.5 sm:text-sm">
        <span aria-hidden className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-warn" />
          <span className="relative inline-flex size-2.5 rounded-full bg-warn" />
        </span>
        <p>
          <strong className="font-semibold text-warn">Educational demo, not medical advice.</strong>{" "}
          <span className="sm:hidden">See a clinician; in an emergency call your local emergency number.</span>
          <span className="hidden sm:inline">
            Predictions may be wrong. Always consult a qualified clinician, and call your local emergency number in an
            emergency.
          </span>
        </p>
      </div>
    </div>
  );
}
