import { describe, expect, it } from "vitest";
import {
  ppcGoogleAdsCampaignStatusBucket,
  ppcRowMatchesGoogleAdsStatusFilter,
} from "@/lib/ppc/ppc-google-ads-status-filter";
import { createIdlePpcCampaignRow } from "@/lib/ppc/google-ads-types";

describe("ppcGoogleAdsCampaignStatusBucket", () => {
  it("maps Google Ads statuses", () => {
    expect(ppcGoogleAdsCampaignStatusBucket("ENABLED")).toBe("active");
    expect(ppcGoogleAdsCampaignStatusBucket("paused")).toBe("paused");
    expect(ppcGoogleAdsCampaignStatusBucket("REMOVED")).toBe("disabled");
    expect(ppcGoogleAdsCampaignStatusBucket(undefined)).toBe("none");
  });
});

describe("ppcRowMatchesGoogleAdsStatusFilter", () => {
  const row = (status?: string) => ({
    ...createIdlePpcCampaignRow(1),
    googleAdsCampaignStatus: status,
  });

  it("defaults active filter to enabled rows only", () => {
    expect(ppcRowMatchesGoogleAdsStatusFilter(row("ENABLED"), "active")).toBe(true);
    expect(ppcRowMatchesGoogleAdsStatusFilter(row("PAUSED"), "active")).toBe(false);
    expect(ppcRowMatchesGoogleAdsStatusFilter(row(undefined), "active")).toBe(false);
  });
});
