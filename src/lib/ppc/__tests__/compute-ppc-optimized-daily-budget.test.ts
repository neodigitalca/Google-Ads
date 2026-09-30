import { describe, expect, it } from "vitest";
import {
  computePpcOptimizedDailyBudget,
  resolvePpcGeneratedDailyBudget,
} from "@/lib/ppc/compute-ppc-optimized-daily-budget";
import type { PpcGoogleResearchSignals } from "@/lib/ppc/ppc-google-research-signals";

const signals: PpcGoogleResearchSignals = {
  focusKeyword: "edmonton seo",
  locationName: "Canada",
  languageCode: "en",
  landingPageUrls: [],
  gscQueries: [],
  dfsKeywordIdeas: [{ text: "edmonton seo", cpc: 5, volume: 2000, source: "dfs_labs" }],
  dfsGoogleAdsKeywords: [],
  accountKeywords: [],
  accountSearchTerms: [],
  serpPaidAds: [],
};

describe("compute-ppc-optimized-daily-budget", () => {
  it("derives a budget from CPC and ad group count", () => {
    const budget = computePpcOptimizedDailyBudget(signals, 2);
    expect(budget).toBeGreaterThanOrEqual(10);
    expect(budget).toBeLessThanOrEqual(500);
  });

  it("prefers the campaign plan recommendation when valid", () => {
    expect(
      resolvePpcGeneratedDailyBudget({
        planRecommendedDailyBudget: 75,
        researchSignals: signals,
        adGroupCount: 2,
      }),
    ).toBe(75);
  });
});
