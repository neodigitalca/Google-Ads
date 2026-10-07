import { describe, expect, it } from "vitest";
import {
  applyGscReportingFinalMarkdownPost,
  normalizeKeywordQuotesToBold,
  normalizeGscReportUnorderedListMarkers,
  stripProseRowsFromPipeTables,
  stripRedundantReportPeriodFootnotes,
  applyGscReportingMarkdownPost,
  unwrapMarkdownLinksInPipeTables,
} from "@/lib/gsc-reporting/gsc-reporting-markdown-post";

describe("gsc-reporting-markdown-post", () => {
  it("normalizes dash bullets to asterisk", () => {
    const md = "- **Repair:** Detail.\n* **Branded:** Detail.";
    expect(normalizeGscReportUnorderedListMarkers(md)).toBe(
      "* **Repair:** Detail.\n* **Branded:** Detail.",
    );
  });

  it("does not change pipe table rows", () => {
    const md = "| Query | Clk |";
    expect(normalizeGscReportUnorderedListMarkers(md)).toBe(md);
  });

  it("removes prose stuffed into table rows", () => {
    const md = [
      "| Month | Total |",
      "| --- | --- |",
      "| July | 95 |",
      "| As more reporting periods are collected, historical period comparisons will become available. |  |",
    ].join("\n");
    expect(stripProseRowsFromPipeTables(md)).not.toContain("As more reporting periods");
    expect(stripProseRowsFromPipeTables(md)).toContain("| July | 95 |");
  });

  it("converts quoted keywords to bold in prose bullets", () => {
    const md = '* "motorized blinds calgary": This query had 120 clicks.';
    expect(normalizeKeywordQuotesToBold(md)).toBe(
      "* **motorized blinds calgary**: This query had 120 clicks.",
    );
  });

  it("does not alter pipe table rows", () => {
    const md = '| "query" | 10 |';
    expect(normalizeKeywordQuotesToBold(md)).toBe(md);
  });

  it("strips redundant period footnotes under tables", () => {
    const md = [
      "| Month | Clk |",
      "_Period: July 1, 2026 to September 30, 2026_",
      "Period: July 1, 2026 to September 30, 2026",
      "_Current: Apr 2026. Prior: Jan 2026._",
    ].join("\n");
    const out = stripRedundantReportPeriodFootnotes(md);
    expect(out).not.toContain("_Period:");
    expect(out).not.toContain("Period: July 1");
    expect(out).toContain("_Current:");
  });

  it("final post applies list normalization", () => {
    const md = "## Section\n\n- **A:** One.\n";
    expect(applyGscReportingFinalMarkdownPost(md)).toContain("* **A:** One.");
  });

  it("unwraps backtick-wrapped markdown links in pipe tables", () => {
    const md =
      "| Page | Clk |\n| --- | --- |\n| `[Blinds Calgary](https://blindswest.ca/)` | 3 |";
    expect(unwrapMarkdownLinksInPipeTables(md)).toBe(
      "| Page | Clk |\n| --- | --- |\n| [Blinds Calgary](https://blindswest.ca/) | 3 |",
    );
    expect(applyGscReportingFinalMarkdownPost(md)).toContain(
      "[Blinds Calgary](https://blindswest.ca/)",
    );
    expect(applyGscReportingFinalMarkdownPost(md)).not.toContain("`[Blinds");
  });

  it("converts backtick and bare URLs in prose to anchors", () => {
    const md =
      "See `https://blindswest.ca/location/canmore/` for detail.\nAlso https://blindswest.ca/blog/roman-vs-roller-shades/.";
    const out = applyGscReportingFinalMarkdownPost(`# Client - SEO REPORT - July 2026\n\n${md}`);
    expect(out).toContain("[Canmore](https://blindswest.ca/location/canmore/)");
    expect(out).toContain("[Roman vs Roller Shades](https://blindswest.ca/blog/roman-vs-roller-shades/)");
    expect(out).toContain("# Client - SEO Report - July 2026");
    expect(out).not.toContain("`https://");
  });
});
