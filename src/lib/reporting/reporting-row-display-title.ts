import { reportDocumentHeadingText as ppcReportDocumentHeadingText } from "@/lib/ads-reporting/ads-reporting-document-title";
import { reportDocumentHeadingText as gscReportDocumentHeadingText } from "@/lib/gsc-reporting/gsc-reporting-document-title";
import type { ReportingLane } from "@/lib/reporting/reporting-lane-artifacts";

/** Report row label: markdown H1 (client + SEO/PPC REPORT + period), not toolbar date text. */
export function reportingLaneRowTitle(lane: ReportingLane, reportMd: string | null): string {
  const md = reportMd?.trim();
  if (!md) return "";
  return lane === "ppc" ? ppcReportDocumentHeadingText(md) : gscReportDocumentHeadingText(md);
}
