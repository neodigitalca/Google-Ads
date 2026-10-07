import type { AdsReportingCompareKind } from "@/lib/ads-reporting/ads-reporting-types";
import { formatReportTitlePeriod } from "@/lib/reporting/reporting-document-title";
import { sanitizeGoogleDriveDocumentTitle } from "@/lib/reporting/reporting-drive-document-title";

export const PPC_REPORT_MARKER = " - PPC Report - ";
const PPC_REPORT_MARKER_LEGACY = " - PPC REPORT - ";

export function ppcReportMarkerIndex(heading: string): number {
  const i = heading.indexOf(PPC_REPORT_MARKER);
  if (i >= 0) return i;
  return heading.indexOf(PPC_REPORT_MARKER_LEGACY);
}

function ppcReportMarkerLengthAt(heading: string, idx: number): number {
  if (heading.slice(idx, idx + PPC_REPORT_MARKER_LEGACY.length) === PPC_REPORT_MARKER_LEGACY) {
    return PPC_REPORT_MARKER_LEGACY.length;
  }
  return PPC_REPORT_MARKER.length;
}

function brandClientName(siteName: string): string {
  const raw = siteName.trim();
  const cut = raw.split(":")[0]?.trim() ?? "";
  return cut || raw;
}

export function buildAdsReportDocumentHeading(
  clientName: string,
  compareLabel: string,
  documentTitlePeriod?: string,
): string {
  const client = brandClientName(clientName);
  const period = documentTitlePeriod?.trim() || formatReportTitlePeriod(compareLabel);
  if (!client) {
    return period ? `PPC Report - ${period}` : "PPC Report";
  }
  if (!period) return `${client} - PPC Report`;
  return `${client}${PPC_REPORT_MARKER}${period}`;
}

export function reportDocumentHeadingText(markdown: string): string {
  const firstLine = markdown.split("\n")[0]?.trim() ?? "";
  if (!firstLine.startsWith("#")) return "";
  return firstLine.slice(1).trim();
}

export function reportPeriodFromAdsMarkdownHeading(markdown: string): string {
  const heading = reportDocumentHeadingText(markdown);
  if (!heading) return "";

  const markerIdx = ppcReportMarkerIndex(heading);
  if (markerIdx >= 0) {
    return heading.slice(markerIdx + ppcReportMarkerLengthAt(heading, markerIdx)).trim();
  }

  const legacyPrefix = "Neo Digital PPC Report - ";
  if (heading.toLowerCase().startsWith(legacyPrefix.toLowerCase())) {
    return heading.slice(legacyPrefix.length).trim();
  }

  const legacyClientSuffix = " - Neo Digital PPC Report - ";
  const legacyIdx = heading.indexOf(legacyClientSuffix);
  if (legacyIdx >= 0) {
    return heading.slice(legacyIdx + legacyClientSuffix.length).trim();
  }

  return "";
}

/** Drive file name matches the report H1 when present; otherwise `{Client} - PPC Report - {range}`. */
export function adsReportingDriveDocumentTitle(siteName: string, markdown: string): string {
  const body = markdown.trim();
  if (!body) {
    throw new Error("PPC Drive title requires report markdown.");
  }

  const heading = reportDocumentHeadingText(body);
  if (ppcReportMarkerIndex(heading) >= 0) {
    return sanitizeGoogleDriveDocumentTitle(heading);
  }

  const period = reportPeriodFromAdsMarkdownHeading(body);
  if (!period) {
    throw new Error("PPC Drive title requires a PPC Report heading with the report date range.");
  }
  const client = sanitizeGoogleDriveDocumentTitle(brandClientName(siteName));
  if (client.length < 2) {
    throw new Error("PPC Drive title requires a client name.");
  }
  return sanitizeGoogleDriveDocumentTitle(`${client}${PPC_REPORT_MARKER}${period}`);
}

export async function generateAdsReportingDriveDocumentTitle(input: {
  siteName: string;
  markdown: string;
}): Promise<string> {
  return adsReportingDriveDocumentTitle(input.siteName, input.markdown);
}

export function adPerformanceH2ForCompareKind(compareKind: AdsReportingCompareKind): string {
  if (compareKind === "period_progress") return "Ad Performance This Period";
  if (compareKind === "yoy") return "Ad Performance Compared Year Over Year";
  if (compareKind === "custom") return "Ad Performance Compared Period Over Period";
  return "Ad Performance Compared Month Over Month";
}
