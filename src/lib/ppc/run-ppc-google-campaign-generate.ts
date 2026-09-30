import type { WordPressSite } from "@/components/integrations/types";
import { formatPpcGoogleCampaignName } from "@/lib/ppc/google-ads-field-limits";
import type {
  PpcCampaign,
  PpcCampaignRow,
  PpcGenerateConfig,
  PpcGscPageContext,
  PpcWpPageContext,
} from "@/lib/ppc/google-ads-types";
import { loadPpcGoogleMasterRules } from "@/lib/ppc/load-ppc-google-master-rules";
import { loadPpcGoogleGscContext } from "@/lib/ppc/google-ads-gsc-context";
import {
  createInitialPpcGenerateProgress,
  patchPpcGenerateStep,
  ppcAdGroupAdStepId,
  ppcAdGroupKeywordsStepId,
  type PpcGenerateProgressState,
  type PpcGenerateStepId,
} from "@/lib/ppc/google-ads-progress-types";
import { loadPpcGoogleWpContext, resolvePpcAllowedLandingPages } from "@/lib/ppc/google-ads-wp-context";
import { runGoogleAdsAdGroupKeywords } from "@/lib/ppc/run-google-ads-ad-group-keywords";
import { runGoogleAdsCampaignPlan, type PpcCampaignPlanAvoidanceInput, type PpcCampaignPlanResult } from "@/lib/ppc/run-google-ads-campaign-plan";
import { runGoogleAdsRsaCopy } from "@/lib/ppc/run-google-ads-rsa-copy";
import { resolvePpcGeneratedDailyBudget } from "@/lib/ppc/compute-ppc-optimized-daily-budget";
import { loadPpcCampaignInsights } from "@/lib/ppc/load-ppc-campaign-insights";
import { loadPpcGoogleResearchSignals } from "@/lib/ppc/load-ppc-google-research-signals";
import {
  ppcCampaignInsightsLast30DayRange,
  type PpcCampaignInsights,
} from "@/lib/ppc/ppc-campaign-insights-types";
import type { PpcGoogleResearchSignals } from "@/lib/ppc/ppc-google-research-signals";
import { normalizeGoogleAdsCustomerId } from "@/lib/ads-reporting/ads-reporting-metrics";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";

export type RunPpcGoogleCampaignGenerateOptions = {
  site: WordPressSite;
  apiKey: string;
  model: string;
  config: PpcGenerateConfig;
  adGroupKeywords?: string[];
  focusKeyword?: string;
  prefetchedWpPages?: PpcWpPageContext[];
  prefetchedPlan?: PpcCampaignPlanResult;
  avoidCampaignPlans?: PpcCampaignPlanAvoidanceInput[];
  adsCampaignId?: string;
  onProgress: (progress: PpcGenerateProgressState) => void;
  signal?: AbortSignal;
};

function resolvePpcCampaignNameKeyword(
  focusKeyword: string | undefined,
  keywordSeeds: string[],
  adGroups: PpcCampaign["adGroups"],
): string {
  return (
    focusKeyword?.trim() ||
    keywordSeeds.find((keyword) => keyword.trim())?.trim() ||
    adGroups[0]?.keywords.find((keyword) => keyword.trim())?.trim() ||
    adGroups[0]?.name?.trim() ||
    ""
  );
}

function createAdId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function patchStep(
  progress: PpcGenerateProgressState,
  stepId: PpcGenerateStepId,
  status: "running" | "done" | "error",
  statusMessage?: string,
): PpcGenerateProgressState {
  return patchPpcGenerateStep(progress, stepId, status, statusMessage);
}

function findPageContext(pages: PpcWpPageContext[], url: string): PpcWpPageContext | undefined {
  const key = normalizePageUrlKey(url);
  return pages.find((p) => normalizePageUrlKey(p.url) === key);
}

function findGscContext(gscPages: PpcGscPageContext[], url: string): PpcGscPageContext | undefined {
  const key = normalizePageUrlKey(url);
  return gscPages.find((g) => normalizePageUrlKey(g.url) === key);
}

export async function runPpcGoogleCampaignGenerate(
  options: RunPpcGoogleCampaignGenerateOptions,
): Promise<{ campaign: PpcCampaign; campaignName: string; recommendedDailyBudget: number }> {
  const { site, apiKey, model, config, adGroupKeywords, focusKeyword, prefetchedWpPages, prefetchedPlan, avoidCampaignPlans, onProgress, signal } =
    options;
  const skipPrefetch = Boolean(prefetchedWpPages);
  const linkedAdsCampaignId = options.adsCampaignId?.trim();
  let progress = createInitialPpcGenerateProgress({
    adGroupCount: config.adGroupCount,
    adsPerAdGroup: config.adsPerAdGroup,
    includePrefetch: !skipPrefetch,
    linkedAdsCampaignId,
  });
  if (prefetchedPlan) {
    progress = patchStep(progress, "campaign-plan", "done");
  }
  onProgress(progress);

  const runStep = async <T>(stepId: PpcGenerateStepId, fn: () => Promise<T>): Promise<T> => {
    progress = patchStep(progress, stepId, "running");
    onProgress(progress);
    try {
      const result = await fn();
      progress = patchStep(progress, stepId, "done");
      onProgress(progress);
      return result;
    } catch (err) {
      progress = patchStep(
        progress,
        stepId,
        "error",
        err instanceof Error ? err.message : "Step failed",
      );
      onProgress(progress);
      throw err;
    }
  };

  const wpPages = skipPrefetch
    ? prefetchedWpPages!
    : await (async () => {
        await runStep("read-master-rules", () => loadPpcGoogleMasterRules(site.id));
        return runStep("load-wp", () => loadPpcGoogleWpContext(site));
      })();
  const allowedLandingPages = resolvePpcAllowedLandingPages(wpPages, config.landingPageUrls);

  const keywordSeeds = (adGroupKeywords ?? []).map((keyword) => keyword.trim()).filter(Boolean);
  const campaignFocusKeyword = focusKeyword?.trim() || keywordSeeds[0] || undefined;
  if (!campaignFocusKeyword) {
    throw new Error("Focus keyword is required to generate a PPC campaign.");
  }
  let campaignName = formatPpcGoogleCampaignName(campaignFocusKeyword);

  const gscSeedPages =
    config.landingPageUrls.length > 0
      ? allowedLandingPages.filter((p) =>
          config.landingPageUrls.some((u) => normalizePageUrlKey(u) === normalizePageUrlKey(p.url)),
        )
      : allowedLandingPages;

  let gscPages = prefetchedPlan
    ? []
    : await runStep("load-gsc", () => loadPpcGoogleGscContext(site, gscSeedPages, signal));

  let researchSignals: PpcGoogleResearchSignals | undefined;
  let campaignLiveInsights: PpcCampaignInsights | undefined;

  const loadLinkedCampaignInsights = async (): Promise<PpcCampaignInsights> => {
    const customerId = normalizeGoogleAdsCustomerId(site.googleAdsCustomerId ?? "");
    if (!customerId) {
      throw new Error("Google Ads customer ID is required to load live campaign insights.");
    }
    if (!linkedAdsCampaignId) {
      throw new Error("Linked Google Ads campaign ID is missing.");
    }
    const range = ppcCampaignInsightsLast30DayRange();
    return loadPpcCampaignInsights({
      customerId,
      campaignId: linkedAdsCampaignId,
      startDate: range.startDate,
      endDate: range.endDate,
      signal,
    });
  };

  if (!prefetchedPlan) {
    researchSignals = await runStep("load-research-signals", () =>
      loadPpcGoogleResearchSignals({
        site,
        focusKeyword: campaignFocusKeyword,
        landingPageUrls: config.landingPageUrls.length > 0 ? config.landingPageUrls : gscSeedPages.map((p) => p.url),
        gscPages,
        signal,
      }),
    );
    if (linkedAdsCampaignId) {
      campaignLiveInsights = await runStep("load-campaign-insights", () => loadLinkedCampaignInsights());
    }
  }

  const plan = prefetchedPlan
    ? prefetchedPlan
    : await runStep("campaign-plan", () =>
        runGoogleAdsCampaignPlan({
          apiKey,
          model,
          siteId: site.id,
          siteName: site.name,
          adGroupCount: config.adGroupCount,
          focusKeyword: campaignFocusKeyword,
          adGroupKeywordSeeds: keywordSeeds,
          landingPages: allowedLandingPages,
          gscPages,
          researchSignals,
          campaignLiveInsights,
          userSelectedLandingUrls: config.landingPageUrls,
          totalCampaigns: (avoidCampaignPlans?.length ?? 0) > 0 ? (avoidCampaignPlans?.length ?? 0) + 1 : undefined,
          avoidCampaignPlans,
          signal,
        }),
      );

  const plannedAdGroups = plan.adGroups.map((adGroup, index) =>
    index === 0 && campaignFocusKeyword
      ? { ...adGroup, name: campaignFocusKeyword, theme: campaignFocusKeyword }
      : adGroup,
  );

  const planLandingPages = plannedAdGroups.map((ag) => {
    const page = findPageContext(wpPages, ag.landingPageUrl);
    if (!page) {
      throw new Error(`Campaign plan picked a landing page not in the page bucket: ${ag.landingPageUrl}`);
    }
    return page;
  });

  if (prefetchedPlan) {
    gscPages = await runStep("load-gsc", () => loadPpcGoogleGscContext(site, planLandingPages, signal));
    researchSignals = await runStep("load-research-signals", () =>
      loadPpcGoogleResearchSignals({
        site,
        focusKeyword: campaignFocusKeyword,
        landingPageUrls: planLandingPages.map((p) => p.url),
        gscPages,
        signal,
      }),
    );
    if (linkedAdsCampaignId) {
      campaignLiveInsights = await runStep("load-campaign-insights", () => loadLinkedCampaignInsights());
    }
  } else {
    const missingPlanPages = planLandingPages.filter(
      (p) => !gscPages.some((g) => normalizePageUrlKey(g.url) === normalizePageUrlKey(p.url)),
    );
    if (missingPlanPages.length > 0) {
      const extra = await loadPpcGoogleGscContext(site, missingPlanPages, signal);
      gscPages = [...gscPages, ...extra];
    }
  }

  const adGroups: PpcCampaign["adGroups"] = [];

  for (let i = 0; i < plannedAdGroups.length; i += 1) {
    const planGroup = plannedAdGroups[i];
    const adGroupIndex = i + 1;
    const landingPage = findPageContext(wpPages, planGroup.landingPageUrl);
    const gscPage = findGscContext(gscPages, planGroup.landingPageUrl);

    const keywordsResult = await runStep(ppcAdGroupKeywordsStepId(adGroupIndex), () =>
      runGoogleAdsAdGroupKeywords({
        apiKey,
        model,
        siteId: site.id,
        campaignName,
        adGroup: planGroup,
        landingPage,
        gscPage,
        focusKeyword:
          i === 0 && campaignFocusKeyword
            ? campaignFocusKeyword
            : adGroupKeywords?.[i]?.trim() || keywordSeeds[i] || undefined,
        researchSignals,
        campaignLiveInsights,
        signal,
      }),
    );

    const ads: PpcCampaign["adGroups"][number]["ads"] = [];

    for (let j = 0; j < config.adsPerAdGroup; j += 1) {
      const adIndex = j + 1;
      const rsa = await runStep(ppcAdGroupAdStepId(adGroupIndex, adIndex), () =>
        runGoogleAdsRsaCopy({
          apiKey,
          model,
          siteId: site.id,
          campaignName,
          adGroup: planGroup,
          landingPage,
          keywords: keywordsResult.keywords,
          adIndex,
          adsPerAdGroup: config.adsPerAdGroup,
          researchSignals,
          campaignLiveInsights,
          signal,
        }),
      );

      ads.push({
        id: createAdId(`ad-${adGroupIndex}-${adIndex}`),
        headlines: rsa.headlines,
        descriptions: rsa.descriptions,
        finalUrl: planGroup.landingPageUrl,
        path1: rsa.path1,
        path2: rsa.path2,
      });
    }

    adGroups.push({
      id: createAdId(`ag-${adGroupIndex}`),
      name: planGroup.name,
      landingPageUrl: planGroup.landingPageUrl,
      keywords: keywordsResult.keywords,
      ads,
    });
  }

  campaignName = formatPpcGoogleCampaignName(
    resolvePpcCampaignNameKeyword(campaignFocusKeyword, keywordSeeds, adGroups),
  );

  const campaign: PpcCampaign = {
    name: campaignName,
    network: "SEARCH",
    adGroups,
  };

  const recommendedDailyBudget = resolvePpcGeneratedDailyBudget({
    planRecommendedDailyBudget: plan.recommendedDailyBudget,
    researchSignals,
    adGroupCount: config.adGroupCount,
  });

  progress = { ...progress, activeStepId: null, label: "Generate campaign", statusMessage: "Complete" };
  onProgress(progress);

  return { campaign, campaignName, recommendedDailyBudget };
}

export type { PpcCampaignRow };
