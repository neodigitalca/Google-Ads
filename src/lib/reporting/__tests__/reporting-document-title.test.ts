import { describe, expect, it } from "vitest";
import { formatReportingDocumentTitlePeriod } from "@/lib/reporting/reporting-document-title";

describe("formatReportingDocumentTitlePeriod", () => {
  it("uses month-year span for filter and period progress", () => {
    expect(
      formatReportingDocumentTitlePeriod({
        structure: "filter",
        primary: { startDate: "2026-07-01", endDate: "2026-09-30" },
      }),
    ).toBe("July 2026 to September 2026");
    expect(
      formatReportingDocumentTitlePeriod({
        structure: "period_progress",
        primary: { startDate: "2026-07-01", endDate: "2026-09-30" },
      }),
    ).toBe("July 2026 to September 2026");
  });

  it("uses month-year pair for compare", () => {
    expect(
      formatReportingDocumentTitlePeriod({
        structure: "compare",
        primary: { startDate: "2026-08-01", endDate: "2026-08-31" },
        compare: { startDate: "2026-07-01", endDate: "2026-07-31" },
      }),
    ).toBe("August 2026 vs July 2026");
  });
});
