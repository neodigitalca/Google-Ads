import { describe, expect, it } from "vitest";
import { gaTrafficAcquisitionMomCsv } from "@/lib/gsc-reporting/gsc-reporting-fetch";
import type { GA4OrganicAcquisitionPeriod } from "@/components/integrations/types";
import {
  buildGaOrganicTrafficTableFromCompareLabel,
  spliceOrganicTrafficAcquisitionTableIntoMarkdown,
} from "@/lib/gsc-reporting/gsc-reporting-ga-organic-table";

const current = {
  sessions: 429,
  engagedSessions: 276,
  engagementRate: 0.6434,
  averageSessionDurationSec: 51,
  keyEvents: 13,
  eventCount: 2196,
  eventsPerSession: 5.12,
} satisfies GA4OrganicAcquisitionPeriod;

const previous = {
  sessions: 412,
  engagedSessions: 252,
  engagementRate: 0.6117,
  averageSessionDurationSec: 64,
  keyEvents: 12,
  eventCount: 2435,
  eventsPerSession: 5.91,
} satisfies GA4OrganicAcquisitionPeriod;

describe("GA organic traffic acquisition report table", () => {
  it("builds wide Organic Search table from MoM CSV", () => {
    const csv = gaTrafficAcquisitionMomCsv(
      { current, previous },
      { start: "2025-12-01", end: "2025-12-31" },
      { start: "2025-11-01", end: "2025-11-30" },
    );
    const table = buildGaOrganicTrafficTableFromCompareLabel(
      csv,
      "December 1, 2025 - December 31, 2025 vs November 1, 2025 - November 30, 2025",
    );
    expect(table).toContain("### Organic Search traffic acquisition");
    expect(table).toContain("Sess");
    expect(table).toContain("Eng sess");
    expect(table).not.toContain("New users");
    expect(table).toContain("429");
    expect(table).toContain("412");
    expect(table).toContain("Current");
    expect(table).toContain("Prior");
    expect(table).toContain("Δ%");
    expect(table).toContain("_Current: December 1, 2025 - December 31, 2025");
  });

  it("splices table into Website Traffic section once", () => {
    const csv = gaTrafficAcquisitionMomCsv(
      { current, previous },
      { start: "2025-12-01", end: "2025-12-31" },
      { start: "2025-11-01", end: "2025-11-30" },
    );
    const table = buildGaOrganicTrafficTableFromCompareLabel(csv, "Period A vs Period B");
    const md = "## Website Traffic From Organic Search\n\nOrganic sessions grew.\n\n## Next";
    const once = spliceOrganicTrafficAcquisitionTableIntoMarkdown(md, table);
    expect(once).toContain("Organic Search traffic acquisition");
    const twice = spliceOrganicTrafficAcquisitionTableIntoMarkdown(once, table);
    expect(twice).toBe(once);
  });
});
