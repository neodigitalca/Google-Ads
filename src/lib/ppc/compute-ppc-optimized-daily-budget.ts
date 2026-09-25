import { PPC_DEFAULT_DAILY_BUDGET } from "@/lib/ppc/google-ads-types";
import type { PpcGoogleResearchSignals } from "@/lib/ppc/ppc-google-research-signals";

/** Minimum suggested daily budget after Generate (not a silent publish default). */
export const PPC_OPTIMIZED_DAILY_BUDGET_MIN = 10;
export const PPC_OPTIMIZED_DAILY_BUDGET_MAX = 500;

function collectCpcValues(signals: PpcGoogleResearchSignals | undefined): number[] {
  const cpcs: number[] = [];
  const lists = [
    signals?.dfsKeywordIdeas,
    signals?.dfsGoogleAdsKeywords,
  ];
  for (const list of lists) {
    for (const item of list ?? []) {
      if (typeof item.cpc === "number" && item.cpc > 0 && Number.isFinite(item.cpc)) {
        cpcs.push(item.cpc);
      }
    }
  }
  return cpcs;
}

export function computePpcOptimizedDailyBudget(
  researchSignals: PpcGoogleResearchSignals | undefined,
  adGroupCount: number,
): number {
  const groups = Math.max(1, adGroupCount);
  const cpcs = collectCpcValues(researchSignals);
  const avgCpc = cpcs.length > 0 ? cpcs.reduce((sum, cpc) => sum + cpc, 0) / cpcs.length : 6;

  const topVolume = [...(researchSignals?.dfsKeywordIdeas ?? []), ...(researchSignals?.dfsGoogleAdsKeywords ?? [])]
    .map((item) => item.volume ?? 0)
    .reduce((max, volume) => Math.max(max, volume), 0);

  const clicksPerAdGroupPerDay = topVolume > 5000 ? 12 : topVolume > 500 ? 18 : 24;
  const raw = Math.ceil(groups * clicksPerAdGroupPerDay * avgCpc);

  return Math.max(PPC_OPTIMIZED_DAILY_BUDGET_MIN, Math.min(PPC_OPTIMIZED_DAILY_BUDGET_MAX, raw));
}

export function resolvePpcGeneratedDailyBudget(options: {
  planRecommendedDailyBudget?: number;
  researchSignals: PpcGoogleResearchSignals | undefined;
  adGroupCount: number;
}): number {
  const fromPlan = options.planRecommendedDailyBudget;
  if (
    typeof fromPlan === "number" &&
    Number.isFinite(fromPlan) &&
    fromPlan >= PPC_DEFAULT_DAILY_BUDGET
  ) {
    return Math.max(
      PPC_OPTIMIZED_DAILY_BUDGET_MIN,
      Math.min(PPC_OPTIMIZED_DAILY_BUDGET_MAX, Math.round(fromPlan)),
    );
  }
  return computePpcOptimizedDailyBudget(options.researchSignals, options.adGroupCount);
}
