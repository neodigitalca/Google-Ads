import { describe, expect, it } from "vitest";
import type { PpcCampaign, PpcCampaignRow } from "@/lib/ppc/google-ads-types";
import { GOOGLE_ADS_KEYWORD_LIMITS_PROMPT } from "@/lib/ppc/google-ads-field-limits";
import {
  assertGoogleAdsPublishBatch,
  buildGoogleAdsPublishRequest,
  buildGoogleAdsSyncRequest,
  collectGoogleAdsPublishRows,
  googleAdsPublishBatchBlockMessage,
} from "@/lib/ppc/google-ads-publish-request";

function readyRow(overrides: Partial<PpcCampaignRow> = {}): PpcCampaignRow {
  const campaign: PpcCampaign = {
    name: "Search - edmonton seo",
    network: "SEARCH",
    adGroups: [
      {
        id: "ag-1",
        name: "Edmonton SEO",
        landingPageUrl: "https://neodigital.ca/edmonton-seo/",
        keywords: ["edmonton seo"],
        ads: [
          {
            id: "ad-1",
            headlines: ["Edmonton SEO Agency", "Rank in Edmonton", "Local Search Help"],
            descriptions: [
              "Get found by Edmonton customers searching for your services.",
              "Work with a local team that focuses on conversions.",
            ],
            finalUrl: "https://neodigital.ca/edmonton-seo/",
          },
        ],
      },
    ],
  };
  return {
    id: "ppc-campaign-1",
    campaignName: campaign.name,
    status: "ready",
    createdAt: "2026-09-24T00:00:00.000Z",
    dailyBudget: 25,
    campaign,
    ...overrides,
  };
}

describe("google-ads-publish-request", () => {
  it("builds a publish body from a ready row and 10-digit customer ID", () => {
    const body = buildGoogleAdsPublishRequest("454-220-8772", readyRow());
    expect(body.customerId).toBe("4542208772");
    expect(body.dailyBudget).toBe(25);
    expect(body.campaign.name).toBe("Search - edmonton seo");
  });

  it("fails when the property has no customer ID", () => {
    expect(() => buildGoogleAdsPublishRequest("", readyRow())).toThrow(
      "Set a 10-digit Google Ads customer ID on this property.",
    );
  });

  it("fails when daily budget is missing or below 1", () => {
    expect(() => buildGoogleAdsPublishRequest("4542208772", readyRow({ dailyBudget: undefined }))).toThrow(
      "set a daily budget of at least 1",
    );
    expect(() => buildGoogleAdsPublishRequest("4542208772", readyRow({ dailyBudget: 0.5 }))).toThrow(
      "set a daily budget of at least 1",
    );
  });

  it("fails when the row is not ready", () => {
    expect(() =>
      buildGoogleAdsPublishRequest("4542208772", readyRow({ status: "idle", campaign: undefined })),
    ).toThrow("generate the campaign before publishing");
  });

  it("fails when the row was already published", () => {
    expect(() => buildGoogleAdsPublishRequest("4542208772", readyRow({ adsCampaignId: "111" }))).toThrow(
      "already published (111)",
    );
  });

  it("fails when keywords or RSA copy are empty", () => {
    const noKeywords = readyRow();
    noKeywords.campaign = {
      ...noKeywords.campaign!,
      adGroups: [{ ...noKeywords.campaign!.adGroups[0]!, keywords: ["  "] }],
    };
    expect(() => buildGoogleAdsPublishRequest("4542208772", noKeywords)).toThrow(
      "add at least one keyword before publishing",
    );

    const thinAd = readyRow();
    thinAd.campaign = {
      ...thinAd.campaign!,
      adGroups: [
        {
          ...thinAd.campaign!.adGroups[0]!,
          ads: [
            {
              id: "ad-1",
              headlines: ["Only one"],
              descriptions: ["Only one description"],
              finalUrl: "https://neodigital.ca/edmonton-seo/",
            },
          ],
        },
      ],
    };
    expect(() => buildGoogleAdsPublishRequest("4542208772", thinAd)).toThrow(
      "at least 3 headlines",
    );

    const longDescription = readyRow();
    longDescription.campaign = {
      ...longDescription.campaign!,
      adGroups: [
        {
          ...longDescription.campaign!.adGroups[0]!,
          ads: [
            {
              id: "ad-1",
              headlines: ["Edmonton SEO Agency", "Rank in Edmonton", "Local Search Help"],
              descriptions: [
                "Unlock your business's online potential. We specialize in local SEO for Edmonton businesses.",
                "Get found by Edmonton customers searching for your services.",
              ],
              finalUrl: "https://neodigital.ca/edmonton-seo/",
            },
          ],
        },
      ],
    };
    expect(() => buildGoogleAdsPublishRequest("4542208772", longDescription)).toThrow(
      "description is too long (max 90 characters)",
    );
  });

  it("requires generated keywords as plain query text", () => {
    expect(GOOGLE_ADS_KEYWORD_LIMITS_PROMPT).toContain("Plain query text only");
    expect(GOOGLE_ADS_KEYWORD_LIMITS_PROMPT).toContain("Do not wrap keywords in quotes");
  });

  it("builds sync requests for published ready rows", () => {
    const published = readyRow({ adsCampaignId: "24285562940", campaignName: "Search - Edmonton SEO 2026" });
    const body = buildGoogleAdsSyncRequest("4542208772", published);
    expect(body.campaignId).toBe("24285562940");
    expect(body.dailyBudget).toBe(25);
    expect(body.campaign.name).toBe("Search - Edmonton SEO 2026");
  });

  it("collects ready unpublished rows and validates the batch first", () => {
    const ready = readyRow();
    const idle = readyRow({ id: "ppc-campaign-2", status: "idle", campaign: undefined, dailyBudget: undefined });
    expect(collectGoogleAdsPublishRows([ready, idle])).toEqual([ready]);
    expect(assertGoogleAdsPublishBatch("4542208772", [ready, idle])).toHaveLength(1);
    expect(googleAdsPublishBatchBlockMessage([idle])).toContain("run Generate before publishing");
    expect(() => assertGoogleAdsPublishBatch("4542208772", [idle])).toThrow("run Generate before publishing");
  });
});
