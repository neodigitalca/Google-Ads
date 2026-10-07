import { describe, expect, it } from "vitest";
import { buildGscTopQueriesPeriodMarkdownTable } from "@/lib/gsc-reporting/gsc-reporting-top-queries-table";
import {
  monthLabelSortKey,
  sortGscReportMarkdownPipeTables,
} from "@/lib/gsc-reporting/gsc-reporting-table-sort";

describe("monthLabelSortKey", () => {
  it("orders calendar months", () => {
    expect(monthLabelSortKey("July 2026")).toBeLessThan(monthLabelSortKey("August 2026"));
    expect(monthLabelSortKey("September 2026")).toBeGreaterThan(monthLabelSortKey("July 2026"));
  });
});

describe("sortGscReportMarkdownPipeTables", () => {
  it("sorts query tables by Clk descending", () => {
    const md = [
      "### Top search queries",
      "",
      "| Query | Clk | Imp | Pos |",
      "| --- | ---: | ---: | ---: |",
      "| how to clean blinds | 0 | 3481 | 15.4 |",
      "| blinds edmonton | 55 | 3371 | 8.6 |",
      "| blind repair edmonton | 12 | 1249 | 14.8 |",
    ].join("\n");
    const out = sortGscReportMarkdownPipeTables(md);
    const dataLines = out.split("\n").filter((l) => l.includes("| blinds"));
    expect(dataLines[0]).toContain("blinds edmonton");
    expect(dataLines[0]).toContain("| 55 |");
  });

  it("sorts month tables chronologically", () => {
    const md = [
      "| Month | Clk | Imp |",
      "| --- | ---: | ---: |",
      "| September 2026 | 100 | 200 |",
      "| July 2026 | 80 | 150 |",
      "| August 2026 | 90 | 160 |",
    ].join("\n");
    const out = sortGscReportMarkdownPipeTables(md);
    const months = out
      .split("\n")
      .filter((l) => /2026/.test(l))
      .map((l) => l.split("|")[1]?.trim());
    expect(months).toEqual(["July 2026", "August 2026", "September 2026"]);
  });
});

describe("buildGscTopQueriesPeriodMarkdownTable", () => {
  it("orders rows by clicks descending", () => {
    const csv = [
      "Query,Clicks,Impressions,CTR,Position",
      "how to clean blinds,0,3481,0%,15.4",
      "blinds edmonton,55,3371,1.6%,8.6",
      "blind repair edmonton,12,1249,1.0%,14.8",
    ].join("\n");
    const md = buildGscTopQueriesPeriodMarkdownTable(csv, "Q3 2026");
    const idxEdmonton = md.indexOf("blinds edmonton");
    const idxRepair = md.indexOf("blind repair edmonton");
    const idxHow = md.indexOf("how to clean blinds");
    expect(idxEdmonton).toBeLessThan(idxRepair);
    expect(idxRepair).toBeLessThan(idxHow);
  });
});
