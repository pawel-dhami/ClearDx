"use client";

import { createElement } from "react";
import type { ReportData } from "./ReportDocument";

/** Short, human-readable report id like "CDX-7K3Q-2M9P" (not a security token). */
export function makeReportId(d = new Date()) {
  const n = (d.getTime() % 1e9).toString(36).toUpperCase().padStart(6, "0");
  const r = Math.floor(Math.random() * 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  return `CDX-${n.slice(0, 4)}-${(n.slice(4) + r).slice(0, 4)}`;
}

/**
 * Renders the report to a PDF in the browser and downloads it.
 * @react-pdf/renderer is imported only here, on click, so it never weighs on page load.
 */
export async function downloadReport(data: Omit<ReportData, "generatedAt" | "reportId">) {
  const [{ pdf }, { ReportDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./ReportDocument")]);
  const generatedAt = new Date();
  const reportId = makeReportId(generatedAt);
  // ReportDocument returns a <Document>, which is what pdf() expects.
  const doc = createElement(ReportDocument, { ...data, generatedAt, reportId }) as unknown as Parameters<typeof pdf>[0];
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ClearDx-report-${generatedAt.toISOString().slice(0, 10)}-${reportId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return reportId;
}
