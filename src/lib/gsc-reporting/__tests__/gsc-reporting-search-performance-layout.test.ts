import { describe, expect, it } from "vitest";
import { assembleSearchPerformanceSectionBody, stripPerQueryKeywordBlocks } from "@/lib/gsc-reporting/gsc-reporting-search-performance-layout";
import { buildGscTopQueriesMarkdownTable } from "@/lib/gsc-reporting/gsc-reporting-top-queries-table";

describe("stripPerQueryKeywordBlocks", () => {
  it("removes keyword title plus Clk/Imp metric bullets", () => {
    const raw = [
      "Site visibility rose overall.",
      "",
      "In the Shade",
      "- Clk: +83.3%",
      "- Imp: +13.1%",
      "Branded term grew.",
      "",
      "- **Momentum:** Non-branded demand expanded.",
    ].join("\n");
    const out = stripPerQueryKeywordBlocks(raw);
    expect(out).toContain("Site visibility rose");
    expect(out).not.toContain("In the Shade");
    expect(out).not.toContain("Clk:");
    expect(out).toContain("**Momentum:**");
  });
});

describe("assembleSearchPerformanceSectionBody", () => {
  it("orders intro, injected tables, then insight bullets", () => {
    const md = assembleSearchPerformanceSectionBody({
      modelBody: "Intro line.\n\n- **Win:** Strong clicks.",
      injectedTables: "### Site search totals (GSC)\n\n| x |",
    });
    expect(md.indexOf("Intro")).toBeLessThan(md.indexOf("Site search totals"));
    expect(md.indexOf("Site search totals")).toBeLessThan(md.indexOf("**Win:**"));
  });
});

describe("buildGscTopQueriesMarkdownTable", () => {
  it("renders query rows as one pipe table", () => {
    const csv = [
      "Query,Clicks (Jul 2026),Clicks (Jul 2025),Clicks Δ%,Impressions (Jul 2026),Impressions (Jul 2025),Impr Δ%,CTR (Jul 2026),CTR (Jul 2025),CTR Δ%,Position (Jul 2026),Position (Jul 2025),Pos Δ%",
      "blinds stuart,10,5,+100.0%,100,50,+100.0%,10%,10%,+0.0%,5,6,-16.7%",
    ].join("\n");
    const md = buildGscTopQueriesMarkdownTable(csv, "Jul 2026 vs Jul 2025");
    expect(md).toContain("### Top search queries");
    expect(md).toContain("| blinds stuart |");
    expect(md).toContain("| Clk |");
  });
});
