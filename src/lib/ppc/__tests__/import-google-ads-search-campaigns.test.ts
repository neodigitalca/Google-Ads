import { describe, expect, it } from "vitest";
import { mergeGoogleAdsImportsIntoPpcRows, type GoogleAdsImportedSearchCampaign } from "@/lib/ppc/import-google-ads-search-campaigns";
import { createIdlePpcCampaignRow } from "@/lib/ppc/google-ads-types";

const sampleImport: GoogleAdsImportedSearchCampaign = {
  campaignId: "21291429280",
  name: "Search - Edmonton SEO",
  status: "PAUSED",
  dailyBudget: 25,
  campaign: {
    name: "Search - Edmonton SEO",
    network: "SEARCH",
    adGroups: [
      {
        id: "ag1",
        name: "Edmonton SEO",
        landingPageUrl: "https://neodigital.ca/edmonton-seo-landing/",
        keywords: ["Edmonton SEO", "SEO Edmonton"],
        ads: [
          {
            id: "ad1",
            headlines: ["Edmonton SEO Experts"],
            descriptions: ["Dominate local search"],
            finalUrl: "https://neodigital.ca/edmonton-seo-landing/",
          },
        ],
      },
    ],
  },
};

describe("mergeGoogleAdsImportsIntoPpcRows", () => {
  it("adds a new row when no matching adsCampaignId", () => {
    const idle = createIdlePpcCampaignRow(1);
    const { rows, importedCount } = mergeGoogleAdsImportsIntoPpcRows([idle], [sampleImport]);
    expect(importedCount).toBe(1);
    expect(rows.some((r) => r.adsCampaignId === "21291429280")).toBe(true);
    const row = rows.find((r) => r.adsCampaignId === "21291429280");
    expect(row?.status).toBe("ready");
    expect(row?.dailyBudget).toBe(25);
    expect(row?.campaign?.adGroups[0]?.keywords).toContain("Edmonton SEO");
  });

  it("fills idle placeholder rows before appending", () => {
    const idleA = createIdlePpcCampaignRow(1);
    const idleB = createIdlePpcCampaignRow(1);
    const { rows, importedCount } = mergeGoogleAdsImportsIntoPpcRows([idleA, idleB], [sampleImport]);
    expect(importedCount).toBe(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.adsCampaignId).toBe("21291429280");
    expect(rows[0]?.id).toBe(idleA.id);
  });

  it("updates an existing row with the same adsCampaignId", () => {
    const existing = {
      ...createIdlePpcCampaignRow(1),
      adsCampaignId: "21291429280",
      campaignName: "Old name",
    };
    const { rows, updatedCount, importedCount } = mergeGoogleAdsImportsIntoPpcRows([existing], [sampleImport]);
    expect(updatedCount).toBe(1);
    expect(importedCount).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.campaignName).toBe("Search - Edmonton SEO");
    expect(rows[0]?.campaign?.adGroups[0]?.ads[0]?.headlines[0]).toBe("Edmonton SEO Experts");
  });
});
