import { describe, expect, it } from "vitest";
import {
  gscSiteTotalsByMonthCsv,
  parseMonthlyTotalsFromApi,
} from "@/lib/gsc-reporting/gsc-reporting-monthly-totals";
import { buildGscSiteTotalsByMonthMarkdownTable } from "@/lib/gsc-reporting/gsc-reporting-monthly-totals-table";
import { countCalendarMonthsInRange } from "@/lib/gsc-reporting/gsc-fetch-date-presets";

describe("gsc-reporting-monthly-totals", () => {
  const months = [
    {
      label: "July 2025",
      startDate: "2025-07-01",
      endDate: "2025-07-31",
      clicks: 100,
      impressions: 1000,
      ctr: 0.1,
      position: 12,
    },
    {
      label: "August 2025",
      startDate: "2025-08-01",
      endDate: "2025-08-31",
      clicks: 150,
      impressions: 1200,
      ctr: 0.125,
      position: 11,
    },
  ];

  it("builds CSV with month facts only (no compare columns)", () => {
    const csv = gscSiteTotalsByMonthCsv(months);
    expect(csv).toContain("July 2025");
    expect(csv).toContain("August 2025");
    expect(csv).toContain("Month,Clk,Imp,CTR,Pos");
    expect(csv).not.toMatch(/Δ|vs prior/i);
  });

  it("parses monthly totals from API rows", () => {
    const parsed = parseMonthlyTotalsFromApi(months);
    expect(parsed).toHaveLength(2);
    expect(parsed[1]?.clicks).toBe(150);
  });

  it("renders markdown table from CSV", () => {
    const csv = gscSiteTotalsByMonthCsv(months);
    const md = buildGscSiteTotalsByMonthMarkdownTable(csv, "Jul 1 to Aug 31, 2025");
    expect(md).toContain("### Site search totals by month (GSC)");
    expect(md).toContain("August 2025");
    expect(md).toContain("| Month | Clk | Imp | CTR | Pos |");
    expect(md).not.toContain("Clk Δ%");
  });

  it("counts calendar months in a range", () => {
    expect(countCalendarMonthsInRange("2025-07-01", "2025-09-30")).toBe(3);
  });
});
