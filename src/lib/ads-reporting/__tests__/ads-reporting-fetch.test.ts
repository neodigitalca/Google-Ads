import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADS_SITE_TOTALS_PERIOD_FILENAME,
  adsBundleHasActivity,
  buildAdsSiteTotalsCsv,
  fetchAdsReportingBundle,
  filesFromAdsReportingBundle,
} from "@/lib/ads-reporting/ads-reporting-fetch";
import {
  formatGoogleAdsCustomerId,
  googleAdsAccountUrl,
  normalizeGoogleAdsCustomerId,
} from "@/lib/ads-reporting/ads-reporting-metrics";
import type { AdsMetrics, AdsReportingBundle } from "@/lib/ads-reporting/ads-reporting-types";

const emptyMetrics: AdsMetrics = {
  impressions: 0,
  clicks: 0,
  costMicros: 0,
  ctr: 0,
  averageCpc: 0,
  conversions: 0,
  conversionsValue: 0,
};

function metrics(partial: Partial<AdsMetrics>): AdsMetrics {
  return { ...emptyMetrics, ...partial };
}

function bundle(partial: Partial<AdsReportingBundle>): AdsReportingBundle {
  return {
    success: true,
    customerId: "1234567890",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    compareStartDate: "2026-07-01",
    compareEndDate: "2026-07-31",
    account: emptyMetrics,
    compareAccount: emptyMetrics,
    campaigns: [],
    compareCampaigns: [],
    keywords: [],
    compareKeywords: [],
    searchTerms: [],
    compareSearchTerms: [],
    ...partial,
  };
}

describe("normalizeGoogleAdsCustomerId", () => {
  it("strips hyphens from the MCC format", () => {
    expect(normalizeGoogleAdsCustomerId("393-713-6350")).toBe("3937136350");
  });
});

describe("googleAdsAccountUrl", () => {
  it("formats a 10-digit customer ID and builds an Ads account URL", () => {
    expect(formatGoogleAdsCustomerId("4542208772")).toBe("454-220-8772");
    expect(googleAdsAccountUrl("454-220-8772")).toBe("https://ads.google.com/aw/campaigns?__c=4542208772");
    expect(googleAdsAccountUrl("4542208772", "393-713-6350")).toBe(
      "https://ads.google.com/aw/campaigns?__c=4542208772&__u=3937136350",
    );
    expect(googleAdsAccountUrl("")).toBeNull();
  });
});

describe("buildAdsSiteTotalsCsv", () => {
  it("includes spend clicks impressions and CPA columns", () => {
    const csv = buildAdsSiteTotalsCsv(
      metrics({ impressions: 1000, clicks: 100, costMicros: 50_000_000, conversions: 5, ctr: 0.1, averageCpc: 500_000 }),
      metrics({ impressions: 800, clicks: 80, costMicros: 40_000_000, conversions: 4, ctr: 0.1, averageCpc: 500_000 }),
      { start: "2026-08-01", end: "2026-08-31" },
      { start: "2026-07-01", end: "2026-07-31" },
    );
    expect(csv).toContain("Spend");
    expect(csv).toContain("Clk");
    expect(csv).toContain("Imp");
    expect(csv).toContain("CPA");
    expect(csv).toContain("50");
  });
});

describe("adsBundleHasActivity", () => {
  it("fails empty accounts", () => {
    expect(adsBundleHasActivity(bundle({}))).toBe(false);
  });

  it("accepts spend or impressions", () => {
    expect(adsBundleHasActivity(bundle({ account: metrics({ impressions: 12 }) }))).toBe(true);
    expect(adsBundleHasActivity(bundle({ account: metrics({ costMicros: 1_000_000 }) }))).toBe(true);
  });
});

describe("fetchAdsReportingBundle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns period files when API succeeds with zero account metrics", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => bundle({}),
      })) as unknown as typeof fetch,
    );
    const res = await fetchAdsReportingBundle(
      "1234567890",
      {
        primary: { startDate: "2026-07-01", endDate: "2026-09-30" },
        compare: { startDate: "2026-04-01", endDate: "2026-06-30" },
      },
      { reportStructure: "period_progress", compareKind: "period_progress" },
    );
    expect(res.startDate).toBe("2026-08-01");
    expect(res.files.some((f) => f.name === ADS_SITE_TOTALS_PERIOD_FILENAME)).toBe(true);
    expect(res.files[0]?.content.length).toBeGreaterThan(0);
  });
});

describe("filesFromAdsReportingBundle", () => {
  it("builds period CSVs for zero-metric bundle", () => {
    const files = filesFromAdsReportingBundle(bundle({}), "period_progress", "Jul 1 to Sep 30, 2026");
    expect(files.map((f) => f.name)).toContain(ADS_SITE_TOTALS_PERIOD_FILENAME);
  });

  it("emits totals campaigns keywords search terms and signals", () => {
    const files = filesFromAdsReportingBundle(
      bundle({
        account: metrics({ impressions: 10, clicks: 2, costMicros: 1_000_000 }),
        campaigns: [
          {
            ...metrics({ costMicros: 1_000_000, clicks: 2 }),
            id: "1",
            name: "Brand",
            status: "ENABLED",
          },
        ],
      }),
      "mom",
      "August 2026 vs July 2026",
    );
    const names = files.map((f) => f.name);
    expect(names).toContain("Ads-site-totals-MoM.csv");
    expect(names).toContain("Ads-campaigns-MoM.csv");
    expect(names).toContain("Ads-keywords-MoM.csv");
    expect(names).toContain("Ads-search-terms-MoM.csv");
    expect(names).toContain("Ads-compare-signals.txt");
  });
});
