import {
  reportDocumentHeadingText,
  reportPeriodFromMarkdownHeading,
  seoReportMarkerIndex,
  SEO_REPORT_MARKER,
} from "@/lib/gsc-reporting/gsc-reporting-document-title";

export type GscDriveDocumentTitleInput = {
  siteName: string;
  markdown: string;
};

export function sanitizeGoogleDriveDocumentTitle(title: string): string {
  return title
    .replace(/[/\\?*:|"<>#]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function brandClientName(siteName: string): string {
  const raw = siteName.trim();
  const cut = raw.split(":")[0]?.trim() ?? "";
  return cut || raw;
}

/** Drive file name matches the report H1 when present; otherwise `{Client} - SEO Report - {range}`. */
export function gscReportingDriveDocumentTitle(siteName: string, markdown: string): string {
  const body = markdown.trim();
  if (!body) {
    throw new Error("GSC Drive title requires report markdown.");
  }

  const heading = reportDocumentHeadingText(body);
  if (seoReportMarkerIndex(heading) >= 0) {
    return sanitizeGoogleDriveDocumentTitle(heading);
  }

  const period = reportPeriodFromMarkdownHeading(body);
  if (!period || period === "Progress Report" || period === "Quarterly Report") {
    throw new Error("GSC Drive title requires an SEO Report heading with the report date range.");
  }

  const client = sanitizeGoogleDriveDocumentTitle(brandClientName(siteName));
  if (client.length < 2) {
    throw new Error("GSC Drive title requires a client name.");
  }
  return sanitizeGoogleDriveDocumentTitle(`${client}${SEO_REPORT_MARKER}${period}`);
}

/** Same contract as the previous async helper so upload callers stay unchanged. */
export async function generateGscReportingDriveDocumentTitle(
  input: GscDriveDocumentTitleInput,
): Promise<string> {
  return gscReportingDriveDocumentTitle(input.siteName, input.markdown);
}
