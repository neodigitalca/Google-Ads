import { describe, expect, it } from "vitest";
import { reportingLaneRowTitle } from "@/lib/reporting/reporting-row-display-title";

describe("reportingLaneRowTitle", () => {
  it("uses markdown H1 for SEO and PPC lanes", () => {
    expect(
      reportingLaneRowTitle(
        "seo",
        "# Blinds West - SEO Report - August 2026 vs July 2026\n\nBody",
      ),
    ).toBe("Blinds West - SEO Report - August 2026 vs July 2026");
    expect(
      reportingLaneRowTitle(
        "ppc",
        "# Blinds West - PPC Report - August 2026 vs July 2026\n\nBody",
      ),
    ).toBe("Blinds West - PPC Report - August 2026 vs July 2026");
  });

  it("returns empty when no markdown", () => {
    expect(reportingLaneRowTitle("seo", null)).toBe("");
  });
});
