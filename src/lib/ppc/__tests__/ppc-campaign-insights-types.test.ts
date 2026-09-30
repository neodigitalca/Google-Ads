import { describe, expect, it } from "vitest";
import { ppcCampaignInsightsForPrompt } from "@/lib/ppc/ppc-campaign-insights-for-prompt";
import {
  normalizePpcCampaignInsights,
  ppcCampaignInsightsHasActivity,
  ppcCampaignInsightsLast30DayRange,
} from "@/lib/ppc/ppc-campaign-insights-types";

describe("ppc-campaign-insights-types", () => {
  it("normalizes summary and daily series", () => {
    const insights = normalizePpcCampaignInsights({
      customerId: "4542208772",
      campaignId: "24285562940",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      summary: { impressions: 100, clicks: 5, costMicros: 5_000_000 },
      dailySeries: [{ date: "2026-02-01", impressions: 50, clicks: 2, costMicros: 2_000_000 }],
      keywords: [
        { text: "edmonton seo", matchType: "PHRASE", campaignName: "C", adGroupName: "AG", clicks: 2, impressions: 5 },
      ],
      searchTerms: [{ searchTerm: "seo edmonton", campaignName: "C", clicks: 1, impressions: 4 }],
      adGroups: [{ id: "1", name: "AG1", clicks: 3, impressions: 10 }],
      structureAdGroups: [{ id: "11", name: "Edmonton SEO", status: "ENABLED" }],
      dailyBudgetMicros: 25_000_000,
    });
    expect(insights.summary.impressions).toBe(100);
    expect(insights.dailySeries).toHaveLength(1);
    expect(insights.keywords).toHaveLength(1);
    expect(insights.keywords[0]?.text).toBe("edmonton seo");
    expect(insights.searchTerms[0]?.searchTerm).toBe("seo edmonton");
    expect(insights.adGroups[0]?.name).toBe("AG1");
    expect(insights.dailyBudgetMicros).toBe(25_000_000);
    expect(insights.structureAdGroups[0]?.name).toBe("Edmonton SEO");
    expect(insights.adGroupDailySeriesById).toEqual({});
    expect(insights.recommendations).toEqual([]);
  });

  it("normalizes scoped daily maps and recommendations", () => {
    const insights = normalizePpcCampaignInsights({
      customerId: "4542208772",
      campaignId: "1",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      summary: {},
      dailySeries: [],
      adGroupDailySeriesById: { "9": [{ date: "2026-02-01", impressions: 1, clicks: 0, costMicros: 0 }] },
      keywordDailySeriesByKey: {},
      keywords: [],
      searchTerms: [],
      adGroups: [],
      structureAdGroups: [],
      recommendations: [
        {
          type: "KEYWORD",
          resourceName: "customers/1/recommendations/2",
          title: "Keyword",
          detail: "new kw",
        },
      ],
    });
    expect(insights.adGroupDailySeriesById["9"]).toHaveLength(1);
    expect(insights.recommendations[0]?.type).toBe("KEYWORD");
  });

  it("includes compare summary when compare dates present", () => {
    const insights = normalizePpcCampaignInsights({
      customerId: "4542208772",
      campaignId: "1",
      startDate: "2026-02-01",
      endDate: "2026-02-28",
      compareStartDate: "2026-01-01",
      compareEndDate: "2026-01-31",
      summary: { impressions: 0 },
      compareSummary: { impressions: 10, clicks: 1 },
      dailySeries: [],
      keywords: [],
      searchTerms: [],
      adGroups: [],
      structureAdGroups: [],
    });
    expect(insights.compareSummary?.impressions).toBe(10);
  });

  it("detects activity vs empty summary", () => {
    const empty = normalizePpcCampaignInsights({
      customerId: "1",
      campaignId: "2",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      summary: {},
      dailySeries: [],
      keywords: [],
      searchTerms: [],
      adGroups: [],
      structureAdGroups: [],
    });
    expect(ppcCampaignInsightsHasActivity(empty)).toBe(false);
    expect(ppcCampaignInsightsHasActivity({ ...empty, summary: { ...empty.summary, clicks: 1 } })).toBe(true);
  });

  it("throws when required fields missing", () => {
    expect(() => normalizePpcCampaignInsights({})).toThrow(/missing/i);
  });

  it("computes last 30 day range as Y-m-d", () => {
    const { startDate, endDate } = ppcCampaignInsightsLast30DayRange(new Date("2026-03-25T12:00:00Z"));
    expect(endDate).toBe("2026-03-25");
    expect(startDate).toBe("2026-02-23");
  });

  it("serializes campaign live lists for prompts with caps", () => {
    const insights = normalizePpcCampaignInsights({
      customerId: "1",
      campaignId: "99",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      campaignStatus: "PAUSED",
      summary: { clicks: 2 },
      dailySeries: [],
      keywords: [{ text: "seo", matchType: "BROAD", campaignName: "C", adGroupName: "A", clicks: 3, impressions: 1 }],
      searchTerms: [{ searchTerm: "local seo", campaignName: "C", clicks: 1 }],
      adGroups: [],
      structureAdGroups: [],
    });
    const prompt = ppcCampaignInsightsForPrompt(insights);
    expect(insights.campaignStatus).toBe("PAUSED");
    expect(prompt?.campaignKeywords[0]?.source).toBe("campaign_live");
    expect(prompt?.campaignSearchTerms[0]?.text).toBe("local seo");
  });
});
