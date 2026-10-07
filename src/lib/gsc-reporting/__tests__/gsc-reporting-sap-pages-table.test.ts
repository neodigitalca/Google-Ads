import { describe, expect, it } from "vitest";
import {
  injectSapEntityPagesTable,
  sapEntityPagesTableFromBundledFiles,
} from "@/lib/gsc-reporting/gsc-reporting-sap-pages-table";

describe("sapEntityPagesTableFromBundledFiles", () => {
  it("builds period table for allowlisted entity URLs", () => {
    const grounding = {
      sourceLabel: "entity-sitemap.xml",
      allowlistUrls: [
        "https://blindswest.ca/location/canmore/",
        "https://blindswest.ca/service-area/hunter-douglas-bridgeland/",
      ],
      filteredPagesEvidence: "",
    };
    const files = [
      {
        name: "Pages-Period.csv",
        content: [
          "# Pages for July 2026 to September 2026.",
          "Page,Clicks,Impressions,CTR,Position",
          "https://blindswest.ca/location/canmore/,10,750,1.3%,8.2",
          "https://blindswest.ca/blog/post/,99,900,2%,5",
          "https://blindswest.ca/service-area/hunter-douglas-bridgeland/,0,9757,0%,12.1",
        ].join("\n"),
      },
    ];
    const table = sapEntityPagesTableFromBundledFiles(grounding, files, { periodProgress: true });
    expect(table).toContain("### Local and entity pages");
    expect(table).toContain("[Canmore](https://blindswest.ca/location/canmore/)");
    expect(table).not.toContain("/blog/post/");
    expect(table).toContain("Hunter Douglas Bridgeland");
  });

  it("injectSapEntityPagesTable skips when model already has Page table", () => {
    const body = "## SAP\n\n| Page | Clk |\n| --- | --- |";
    expect(injectSapEntityPagesTable(body, "| Page | Clk |\n|---|---|")).toBe(body);
  });
});
