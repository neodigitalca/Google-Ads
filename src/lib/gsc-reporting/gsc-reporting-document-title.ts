import type { GscReportStructure } from "@/lib/gsc-reporting/gsc-reporting-monthly-totals";

export type GscReportDocumentHeadingOptions = {
  reportStructure?: GscReportStructure;
  monthCount?: number;
  /** Month/year only period for H1 (overrides day-level compareLabel). */
  documentTitlePeriod?: string;
};

export const SEO_REPORT_MARKER = " - SEO Report - ";
const SEO_REPORT_MARKER_LEGACY = " - SEO REPORT - ";

export function seoReportMarkerIndex(heading: string): number {
  const i = heading.indexOf(SEO_REPORT_MARKER);
  if (i >= 0) return i;
  return heading.indexOf(SEO_REPORT_MARKER_LEGACY);
}

function seoReportMarkerLengthAt(heading: string, idx: number): number {
  if (heading.slice(idx, idx + SEO_REPORT_MARKER_LEGACY.length) === SEO_REPORT_MARKER_LEGACY) {
    return SEO_REPORT_MARKER_LEGACY.length;
  }
  return SEO_REPORT_MARKER.length;
}

function brandClientName(siteName: string): string {
  const raw = siteName.trim();
  const cut = raw.split(":")[0]?.trim() ?? "";
  return cut || raw;
}

/** Current-period range from a GSC compare label (text before " vs "). */
export function formatGscReportTitlePeriod(compareLabel: string): string {
  if (!compareLabel.includes(" vs ")) return compareLabel.trim();
  return compareLabel.split(" vs ")[0]?.trim() ?? "";
}

/** Primary period month and year from a GSC compare label, e.g. "July 2026". */
export function formatGscReportTitleMonthYear(compareLabel: string): string {
  const primary = formatGscReportTitlePeriod(compareLabel);
  if (!primary) return "";

  const comma = primary.lastIndexOf(",");
  if (comma < 0) return "";

  const year = primary.slice(comma + 1).trim();
  const month = primary.split(" ")[0]?.trim() ?? "";
  if (!month || !year) return "";

  return `${month} ${year}`;
}

export function buildGscReportDocumentHeading(
  clientName: string,
  compareLabel: string,
  options?: GscReportDocumentHeadingOptions,
): string {
  const client = brandClientName(clientName);
  const period = options?.documentTitlePeriod?.trim() || formatGscReportTitlePeriod(compareLabel);
  if (!client) {
    return period ? `SEO Report - ${period}` : "SEO Report";
  }
  if (!period) return `${client} - SEO Report`;
  return `${client}${SEO_REPORT_MARKER}${period}`;
}

export function reportDocumentHeadingText(markdown: string): string {
  const firstLine = markdown.split("\n")[0]?.trim() ?? "";
  if (!firstLine.startsWith("#")) return "";
  return firstLine.slice(1).trim();
}

export function reportPeriodFromMarkdownHeading(markdown: string): string {
  const heading = reportDocumentHeadingText(markdown);
  if (!heading) return "";

  const markerIdx = seoReportMarkerIndex(heading);
  if (markerIdx >= 0) {
    return heading.slice(markerIdx + seoReportMarkerLengthAt(heading, markerIdx)).trim();
  }

  if (heading === "Progress Report" || heading === "Quarterly Report") {
    return heading;
  }

  const legacyPrefix = "Neo Digital SEO Report - ";
  if (heading.toLowerCase().startsWith(legacyPrefix.toLowerCase())) {
    return heading.slice(legacyPrefix.length).trim();
  }

  const legacyClientSuffix = " - Neo Digital SEO Report - ";
  const legacyIdx = heading.indexOf(legacyClientSuffix);
  if (legacyIdx >= 0) {
    return heading.slice(legacyIdx + legacyClientSuffix.length).trim();
  }

  return "";
}
