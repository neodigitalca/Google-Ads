import { computePpcOptimizedDailyBudget } from "@/lib/ppc/compute-ppc-optimized-daily-budget";
import {
  PPC_DEFAULT_DAILY_BUDGET,
  ppcRowPatchFromGeneratedCampaign,
  ppcRowUserInputPreserve,
  type PpcCampaign,
  type PpcCampaignRow,
} from "@/lib/ppc/google-ads-types";

function resolvedRecommendedDailyBudget(recommended: number | undefined, adGroupCount: number): number {
  const fromGenerate =
    typeof recommended === "number" && Number.isFinite(recommended) && recommended >= PPC_DEFAULT_DAILY_BUDGET
      ? Math.round(recommended)
      : computePpcOptimizedDailyBudget(undefined, adGroupCount);
  return Math.max(PPC_DEFAULT_DAILY_BUDGET, fromGenerate);
}

export function applyPpcGenerateResultToRow(
  sourceRow: PpcCampaignRow,
  campaign: PpcCampaign,
  recommendedDailyBudget: number | undefined,
  adGroupCount: number,
): Partial<PpcCampaignRow> {
  const dailyBudget = resolvedRecommendedDailyBudget(recommendedDailyBudget, adGroupCount);
  const preserve = ppcRowUserInputPreserve(sourceRow);
  const patch = ppcRowPatchFromGeneratedCampaign(campaign, preserve, dailyBudget);
  const keepUser =
    typeof preserve.dailyBudget === "number" &&
    Number.isFinite(preserve.dailyBudget) &&
    preserve.dailyBudget >= PPC_DEFAULT_DAILY_BUDGET;

  return {
    ...patch,
    dailyBudget: keepUser ? preserve.dailyBudget : dailyBudget,
  };
}

/** Ready rows missing a budget get a computed value (e.g. session restored before Generate wrote one). */
export function ensurePpcRowDailyBudget(row: PpcCampaignRow): PpcCampaignRow {
  if (row.status !== "ready" || !row.campaign) {
    return row;
  }
  if (
    typeof row.dailyBudget === "number" &&
    Number.isFinite(row.dailyBudget) &&
    row.dailyBudget >= PPC_DEFAULT_DAILY_BUDGET
  ) {
    return row;
  }
  const adGroupCount = row.campaign.adGroups.length || row.config?.adGroupCount || 1;
  return {
    ...row,
    dailyBudget: computePpcOptimizedDailyBudget(undefined, adGroupCount),
  };
}
