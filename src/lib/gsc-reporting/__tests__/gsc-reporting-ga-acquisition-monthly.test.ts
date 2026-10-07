import { describe, expect, it } from "vitest";
import {
  buildGaOrganicTrafficAcquisitionByMonthMarkdownTable,
  gaOrganicTrafficAcquisitionByMonthCsv,
  parseGaOrganicTrafficAcquisitionByMonthCsv,
} from "@/lib/gsc-reporting/gsc-reporting-ga-acquisition-monthly";
import type { GA4OrganicTrafficAcquisitionMonthlyBlock } from "@/components/integrations/types";

const sampleBlock: GA4OrganicTrafficAcquisitionMonthlyBlock = {
  channel: "Organic Search",
  dimension: "sessionDefaultChannelGroup",
  periodStart: "2026-07-01",
  periodEnd: "2026-09-30",
  totals: {
    sessions: 3200,
    engagedSessions: 3100,
    engagementRate: 0.95,
    averageSessionDurationSec: 0,
    eventsPerSession: 6.1,
    eventCount: 19000,
    keyEvents: 30,
  },
  months: [
    {
      yearMonth: "202609",
      label: "September 2026",
      sessions: 1200,
      engagedSessions: 1196,
      engagementRate: 0.9967,
      averageSessionDurationSec: 0,
      eventsPerSession: 6.1,
      eventCount: 7323,
      keyEvents: 11,
    },
  ],
};

describe("gsc-reporting-ga-acquisition-monthly", () => {
  it("builds CSV and markdown with September sessions", () => {
    const csv = gaOrganicTrafficAcquisitionByMonthCsv(sampleBlock);
    expect(csv).toContain("September 2026");
    expect(csv).toContain("Sessions,3,200");
    const md = buildGaOrganicTrafficAcquisitionByMonthMarkdownTable(csv);
    expect(md).toContain("### Organic Search traffic acquisition");
    expect(md).toContain("| September 2026 | 1,200 |");
    const parsed = parseGaOrganicTrafficAcquisitionByMonthCsv(csv);
    expect(parsed.totals?.sessions).toBe(3200);
  });
});
