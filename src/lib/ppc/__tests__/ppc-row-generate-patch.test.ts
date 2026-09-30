import { describe, expect, it } from "vitest";
import type { PpcCampaign } from "@/lib/ppc/google-ads-types";
import { applyPpcGenerateResultToRow, ensurePpcRowDailyBudget } from "@/lib/ppc/ppc-row-generate-patch";

const campaign: PpcCampaign = {
  name: "Search - edmonton seo",
  network: "SEARCH",
  adGroups: [{ id: "ag-1", name: "edmonton seo", landingPageUrl: "https://example.com/", keywords: [], ads: [] }],
};

describe("ppc-row-generate-patch", () => {
  it("writes daily budget on generate when the row had none", () => {
    const patch = applyPpcGenerateResultToRow(
      { id: "1", campaignName: "", status: "idle", createdAt: "", focusKeyword: "edmonton seo" },
      campaign,
      55,
      1,
    );
    expect(patch.dailyBudget).toBe(55);
  });

  it("backfills budget on ready rows loaded from session", () => {
    const row = ensurePpcRowDailyBudget({
      id: "1",
      campaignName: "Search - test",
      status: "ready",
      createdAt: "",
      campaign,
    });
    expect(row.dailyBudget).toBeGreaterThanOrEqual(10);
  });
});
