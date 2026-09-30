import { describe, expect, it } from "vitest";
import {
  PPC_DEFAULT_DAILY_BUDGET,
  createIdlePpcCampaignRow,
  ppcRowPatchFromGeneratedCampaign,
  ppcRowUserInputPreserve,
  resolvePpcRowDailyBudgetOrDefault,
  type PpcCampaign,
} from "@/lib/ppc/google-ads-types";
import { syncPpcCampaignRowsToCount } from "@/lib/ppc/sync-ppc-campaign-rows";

const campaign: PpcCampaign = {
  name: "Search - edmonton seo",
  network: "SEARCH",
  adGroups: [
    {
      id: "ag-1",
      name: "edmonton seo",
      landingPageUrl: "https://neodigital.ca/edmonton-seo/",
      keywords: ["edmonton seo"],
      ads: [],
    },
  ],
};

describe("PPC default daily budget", () => {
  it("leaves daily budget empty on a new campaign row", () => {
    expect(createIdlePpcCampaignRow().dailyBudget).toBeUndefined();
  });

  it("fills daily budget from Generate when the row had no user budget", () => {
    const patch = ppcRowPatchFromGeneratedCampaign(campaign, undefined, 48);
    expect(patch.dailyBudget).toBe(48);
  });

  it("does not overwrite a user budget that is at least 1", () => {
    const patch = ppcRowPatchFromGeneratedCampaign(campaign, { dailyBudget: 25 }, 48);
    expect(patch.dailyBudget).toBe(25);
  });

  it("keeps a user budget that is at least 1", () => {
    expect(ppcRowPatchFromGeneratedCampaign(campaign, { dailyBudget: 25 }).dailyBudget).toBe(25);
    expect(
      ppcRowUserInputPreserve({
        id: "ppc-campaign-1",
        campaignName: "",
        status: "idle",
        createdAt: "",
        dailyBudget: 25,
      }).dailyBudget,
    ).toBe(25);
  });

  it("does not backfill daily budget when syncing row count", () => {
    const [row] = syncPpcCampaignRowsToCount(
      [
        {
          id: "ppc-campaign-1",
          campaignName: "Search - edmonton seo",
          status: "ready",
          createdAt: "2026-09-24T00:00:00.000Z",
          campaign,
        },
      ],
      1,
      3,
    );
    expect(row?.dailyBudget).toBeUndefined();
  });

  it("rejects values below 1 and replaces them with 1", () => {
    expect(resolvePpcRowDailyBudgetOrDefault(undefined)).toBe(PPC_DEFAULT_DAILY_BUDGET);
    expect(resolvePpcRowDailyBudgetOrDefault(0.5)).toBe(PPC_DEFAULT_DAILY_BUDGET);
  });
});
