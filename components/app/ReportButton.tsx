"use client";

import { useState } from "react";
import type { ReportData } from "@/lib/report/ReportDocument";

type Props = Omit<ReportData, "generatedAt" | "reportId"> & { disabled?: boolean };

/** "Download report (PDF)": builds the PDF on demand in the browser. */
export function ReportButton({ disabled, ...data }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const go = async () => {
    setState("busy");
    try {
      const { downloadReport } = await import("@/lib/report/download");
      await downloadReport(data);
      setState("idle");
    } catch (e) {
      console.error("[report]", e);
      setState("error");
    }
  };
  return (
    <button
      type="button"
      onClick={go}
      disabled={disabled || state === "busy"}
      className={`btn btn-ghost !min-h-8 !px-3 ${state === "error" ? "!border-contra !text-contra" : ""}`}
      aria-live="polite"
    >
      {state === "busy" ? (
        <>
          <svg className="size-3.5 animate-spin" viewBox="0 0 14 14" aria-hidden>
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 20" />
          </svg>
          Building PDF
        </>
      ) : state === "error" ? (
        "PDF failed · retry"
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M7 1.5v7.5M3.8 6l3.2 3.2L10.2 6M2 12.5h10" strokeLinecap="square" />
          </svg>
          Report PDF
        </>
      )}
    </button>
  );
}
