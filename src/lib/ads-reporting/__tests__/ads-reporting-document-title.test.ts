import { describe, expect, it } from "vitest";
import {
  adsReportingDriveDocumentTitle,
  buildAdsReportDocumentHeading,
  generateAdsReportingDriveDocumentTitle,
  reportPeriodFromAdsMarkdownHeading,
} from "@/lib/ads-reporting/ads-reporting-document-title";

describe("ads-reporting-document-title", () => {
  it("builds client - PPC Report - month-year for compare and filter", () => {
    expect(
      buildAdsReportDocumentHeading(
        "Advance Blinds",
        "August 1, 2026 to August 31, 2026 vs July 1–31, 2026",
        "August 2026 vs July 2026",
      ),
    ).toBe("Advance Blinds - PPC Report - August 2026 vs July 2026");
    expect(
      buildAdsReportDocumentHeading(
        "Blind Magic",
        "July 1, 2026 to September 30, 2026",
        "July 2026 to September 2026",
      ),
    ).toBe("Blind Magic - PPC Report - July 2026 to September 2026");
  });

  it("parses period from PPC Report heading", () => {
    expect(
      reportPeriodFromAdsMarkdownHeading(
        "# Blind Magic - PPC Report - August 2026 vs July 2026\n\nNeo Digital Inc",
      ),
    ).toBe("August 2026 vs July 2026");
  });

  it("drive title uses H1 when it matches PPC Report format", () => {
    expect(
      adsReportingDriveDocumentTitle(
        "Blinds West",
        [
          "# Blinds West - PPC Report - August 2026 vs July 2026",
          "",
          "Neo Digital Inc",
        ].join("\n"),
      ),
    ).toBe("Blinds West - PPC Report - August 2026 vs July 2026");
  });

  it("generateAdsReportingDriveDocumentTitle resolves from markdown H1", async () => {
    await expect(
      generateAdsReportingDriveDocumentTitle({
        siteName: "Blinds West",
        markdown: "# Blinds West - PPC Report - August 2026 vs July 2026\n\nBody",
      }),
    ).resolves.toBe("Blinds West - PPC Report - August 2026 vs July 2026");
  });

  it("drive title fails when heading has no PPC Report range", () => {
    expect(() =>
      adsReportingDriveDocumentTitle("Blinds West", "# Quarterly Report\n\nBody"),
    ).toThrow("PPC Drive title requires a PPC Report heading with the report date range.");
  });
});
