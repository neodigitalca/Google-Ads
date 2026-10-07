import { describe, expect, it } from "vitest";
import {
  buildGscReportDocumentHeading,
  formatGscReportTitleMonthYear,
  formatGscReportTitlePeriod,
  reportPeriodFromMarkdownHeading,
} from "@/lib/gsc-reporting/gsc-reporting-document-title";

describe("gsc-reporting-document-title", () => {
  it("extracts the current period range from the compare label", () => {
    expect(formatGscReportTitlePeriod("April 1, 2026 to April 30, 2026 vs March 1–31, 2026")).toBe(
      "April 1, 2026 to April 30, 2026",
    );
  });

  it("extracts month and year from compare label", () => {
    expect(formatGscReportTitleMonthYear("July 1–31, 2026 vs June 1–30, 2026")).toBe("July 2026");
    expect(formatGscReportTitleMonthYear("April 1, 2026 to April 30, 2026 vs March 1–31, 2026")).toBe(
      "April 2026",
    );
  });

  it("builds client - SEO Report - month-year for compare", () => {
    expect(
      buildGscReportDocumentHeading(
        "Advance Blinds: Blinds, Shades & Drapery In Manitoba",
        "August 1, 2026 to August 31, 2026 vs July 1–31, 2026",
        { documentTitlePeriod: "August 2026 vs July 2026" },
      ),
    ).toBe("Advance Blinds - SEO Report - August 2026 vs July 2026");
  });

  it("uses month-year span for period progress", () => {
    expect(
      buildGscReportDocumentHeading("Ridgeline Solar", "July 1, 2025 to September 30, 2025", {
        reportStructure: "period_progress",
        monthCount: 3,
        documentTitlePeriod: "July 2025 to September 2025",
      }),
    ).toBe("Ridgeline Solar - SEO Report - July 2025 to September 2025");
  });

  it("reads period back from markdown heading", () => {
    expect(
      reportPeriodFromMarkdownHeading(
        "# Advance Blinds - SEO Report - August 2026 vs July 2026\n\nNeo Digital Inc",
      ),
    ).toBe("August 2026 vs July 2026");
    expect(
      reportPeriodFromMarkdownHeading(
        "# Advance Blinds - SEO REPORT - August 2026 vs July 2026\n\nNeo Digital Inc",
      ),
    ).toBe("August 2026 vs July 2026");
  });
});
