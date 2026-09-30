import { describe, expect, it } from "vitest";
import {
  ppcKeywordDailySeriesKey,
  resolvePpcInsightsScopeView,
  sumPpcInsightsDailySeries,
} from "@/lib/ppc/ppc-campaign-insights-scope";
import { normalizePpcCampaignInsights } from "@/lib/ppc/ppc-campaign-insights-types";

const baseInsights = normalizePpcCampaignInsights({
  customerId: "4542208772",
  campaignId: "1",
  startDate: "2026-02-01",
  endDate: "2026-02-28",
  summary: { impressions: 10, clicks: 2, costMicros: 2_000_000 },
  dailySeries: [{ date: "2026-02-01", impressions: 10, clicks: 2, costMicros: 2_000_000 }],
  adGroupDailySeriesById: {
    "99": [{ date: "2026-02-01", impressions: 5, clicks: 1, costMicros: 1_000_000 }],
  },
  keywordDailySeriesByKey: {
    "99|edmonton seo": [{ date: "2026-02-02", impressions: 3, clicks: 1, costMicros: 500_000 }],
  },
  adDailySeriesByKey: {
    "99|1001": [{ date: "2026-02-03", impressions: 2, clicks: 1, costMicros: 300_000 }],
  },
  keywords: [],
  searchTerms: [],
  adGroups: [],
  structureAdGroups: [],
  recommendations: [],
});

describe("ppc-campaign-insights-scope", () => {
  it("uses campaign series at campaign level", () => {
    const view = resolvePpcInsightsScopeView(baseInsights, { level: "campaign" });
    expect(view.dailySeries).toHaveLength(1);
    expect(view.summary.clicks).toBe(2);
    expect(view.missingSeries).toBe(false);
  });

  it("uses ad group bucket without falling back to campaign", () => {
    const view = resolvePpcInsightsScopeView(baseInsights, {
      level: "ad_group",
      adGroupId: "99",
      label: "Edmonton SEO",
    });
    expect(view.summary.clicks).toBe(1);
    expect(view.scopeLabel).toContain("Edmonton SEO");
  });

  it("returns empty ad group series when id unknown", () => {
    const view = resolvePpcInsightsScopeView(baseInsights, {
      level: "ad_group",
      adGroupId: "missing",
      label: "X",
    });
    expect(view.dailySeries).toHaveLength(0);
    expect(view.missingSeries).toBe(true);
    expect(view.hasActivity).toBe(false);
  });

  it("resolves ad level series", () => {
    const view = resolvePpcInsightsScopeView(baseInsights, {
      level: "ad",
      adGroupId: "99",
      adId: "1001",
      label: "RSA 1001",
    });
    expect(view.summary.clicks).toBe(1);
    expect(view.scopeLabel).toContain("RSA");
  });

  it("resolves keyword key", () => {
    const key = ppcKeywordDailySeriesKey("99", "edmonton seo");
    expect(key).toBe("99|edmonton seo");
    const view = resolvePpcInsightsScopeView(baseInsights, {
      level: "keyword",
      adGroupId: "99",
      keywordText: "edmonton seo",
      label: "edmonton seo",
    });
    expect(view.summary.costMicros).toBe(500_000);
  });

  it("sums daily points into metrics", () => {
    const summary = sumPpcInsightsDailySeries([
      { date: "2026-02-01", impressions: 2, clicks: 1, costMicros: 100, conversions: 0, conversionsValue: 0 },
      { date: "2026-02-02", impressions: 3, clicks: 2, costMicros: 200, conversions: 0, conversionsValue: 0 },
    ]);
    expect(summary.impressions).toBe(5);
    expect(summary.clicks).toBe(3);
    expect(summary.costMicros).toBe(300);
  });
});
