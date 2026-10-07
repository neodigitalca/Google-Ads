import { describe, expect, it } from "vitest";
import {
  buildGscSiteTotalsMarkdownTable,
  spliceGscSiteTotalsIntoSearchPerformance,
} from "@/lib/gsc-reporting/gsc-reporting-site-totals-table";

const SAMPLE_CSV = [
  "# Site totals",
  "Metric,Jul 2026,Jun 2026,% change vs prior",
  "Total clicks,100,80,+25.0%",
  "Total impressions,1000,900,+11.1%",
  "Search queries,50,40,+25.0%",
  "Average CTR,10.00%,8.00%,+25.0%",
  "Average position,5.0,6.0,-16.7%",
].join("\n");

describe("GSC site totals table", () => {
  it("uses acronym headers and Current/Prior/Δ% rows", () => {
    const table = buildGscSiteTotalsMarkdownTable(
      SAMPLE_CSV,
      "July 1, 2026 to September 30, 2026 vs Jul 1, 2025 – Sep 30, 2025",
    );
    expect(table).toContain("Clk");
    expect(table).toContain("Imp");
    expect(table).toContain("Queries");
    expect(table).toContain("Current");
    expect(table).toContain("Prior");
    expect(table).toContain("Δ%");
    expect(table).not.toContain("Jul 2026");
    expect(table).toContain("_Current: July 1, 2026");
  });

  it("splices into Search Performance section once", () => {
    const table = buildGscSiteTotalsMarkdownTable(SAMPLE_CSV, "A vs B");
    const md = "## Search Performance Compared Year Over Year\n\nProse.\n\n## Key Performance";
    const once = spliceGscSiteTotalsIntoSearchPerformance(md, table);
    expect(once.indexOf("Search Performance")).toBeLessThan(once.indexOf("Site search totals"));
    const twice = spliceGscSiteTotalsIntoSearchPerformance(once, table);
    expect(twice).toBe(once);
  });
});
