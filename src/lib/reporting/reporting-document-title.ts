import {
  formatCompareMonthYearPair,
  formatReportTitleMonthYearSpan,
} from "@/lib/reporting/reporting-date-presets";

/** Current-period range from a compare label (text before " vs "). */
export function formatReportTitlePeriod(compareLabel: string): string {
  if (!compareLabel.includes(" vs ")) return compareLabel.trim();
  return compareLabel.split(" vs ")[0]?.trim() ?? "";
}

export type ReportingDocumentTitleStructure = "compare" | "period_progress" | "filter";

export type ReportingDocumentTitlePeriodInput = {
  structure: ReportingDocumentTitleStructure;
  primary: { startDate: string; endDate: string };
  compare?: { startDate: string; endDate: string };
};

/** Month and year only for report H1 (no day-level ranges). */
export function formatReportingDocumentTitlePeriod(input: ReportingDocumentTitlePeriodInput): string {
  if (input.structure === "compare") {
    const compareStart = input.compare?.startDate?.trim();
    if (compareStart) {
      return formatCompareMonthYearPair(input.primary.startDate, compareStart);
    }
  }
  return formatReportTitleMonthYearSpan(input.primary.startDate, input.primary.endDate);
}
