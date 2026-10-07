import { describe, expect, it } from "vitest";
import {
  buildGaOrganicUsersByMonthMarkdownTable,
  gaOrganicUsersByMonthCsv,
  parseGaOrganicUsersByMonthCsv,
} from "@/lib/gsc-reporting/gsc-reporting-ga-organic-monthly";
import type { GA4OrganicUsersMonthlyBlock } from "@/components/integrations/types";

const sampleBlock: GA4OrganicUsersMonthlyBlock = {
  medium: "organic",
  dimension: "firstUserMedium",
  periodStart: "2026-07-01",
  periodEnd: "2026-09-30",
  totals: {
    totalUsers: 1054,
    newUsers: 1051,
    userKeyEventRate: 0.04,
    keyEvents: 12,
  },
  months: [
    {
      yearMonth: "202607",
      label: "July 2026",
      totalUsers: 300,
      newUsers: 295,
      userKeyEventRate: 0.01,
      keyEvents: 2,
    },
    {
      yearMonth: "202608",
      label: "August 2026",
      totalUsers: 350,
      newUsers: 348,
      userKeyEventRate: 0.025,
      keyEvents: 4,
    },
  ],
};

describe("gsc-reporting-ga-organic-monthly", () => {
  it("builds CSV with monthly rows and period totals", () => {
    const csv = gaOrganicUsersByMonthCsv(sampleBlock);
    expect(csv).toContain("July 2026");
    expect(csv).toContain("Period total");
    expect(csv).toContain("Total users,1,054");
    const parsed = parseGaOrganicUsersByMonthCsv(csv);
    expect(parsed.months).toHaveLength(2);
    expect(parsed.totals?.totalUsers).toBe(1054);
  });

  it("builds markdown month table", () => {
    const csv = gaOrganicUsersByMonthCsv(sampleBlock);
    const md = buildGaOrganicUsersByMonthMarkdownTable(csv);
    expect(md).toContain("### Organic users by month (GA4)");
    expect(md).toContain("| August 2026 |");
    expect(md).toContain("| **Period total** | 1,054 |");
    expect(md).toContain("Note: As more reporting periods");
    expect(md).not.toMatch(/\| Note:/);
  });
});
