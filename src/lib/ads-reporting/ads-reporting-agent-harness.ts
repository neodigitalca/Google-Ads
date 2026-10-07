import type { WordPressSite } from "@/components/integrations/types";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";
import { getAdsModel } from "@/lib/optimization-settings-storage";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import {
  computeCompareRangesForPreset,
  formatComparePeriodLabel,
  formatReportFullDateRange,
} from "@/lib/reporting/reporting-date-presets";
import { formatReportingDocumentTitlePeriod } from "@/lib/reporting/reporting-document-title";
import type {
  AdsReportStructure,
  AdsReportingCompareKind,
  AdsReportingDateRanges,
} from "@/lib/ads-reporting/ads-reporting-types";
import { adsReportStructureToApi } from "@/lib/ads-reporting/ads-reporting-types";
import { fetchAdsReportingBundle } from "@/lib/ads-reporting/ads-reporting-fetch";
import { runAdsReportingPipeline } from "@/lib/ads-reporting/ads-reporting-pipeline";
import {
  ADS_REPORTING_PROGRESS_LABELS,
  type AdsReportingOutlineResult,
  type AdsReportingPipelineProgress,
  type AdsReportingPipelineResult,
  type AdsReportingSectionResult,
} from "@/lib/ads-reporting/ads-reporting-types";
import { formatAdsBundleApiLabel, formatAdsBundleReadyLabel } from "@/lib/ads-reporting/ads-reporting-progress-log";
import { resolveGoogleAdsCustomerIdForReportingAsync } from "@/lib/ads-reporting/ads-reporting-metrics";
import type { AgentRunResumePoint } from "@/lib/agent-runs-types";

export type AdsReportingAutomationComparePreset = "mom" | "yoy";

function resolveAdsCompareKind(
  comparePreset: AdsReportingAutomationComparePreset,
  compareRanges: AdsReportingDateRanges | undefined,
  reportStructure: AdsReportStructure,
): AdsReportingCompareKind {
  if (reportStructure === "filter") return "period_progress";
  if (comparePreset === "yoy") return "yoy";
  if (compareRanges) return "custom";
  return "mom";
}

export type RunAdsReportingAgentHarnessArgs = {
  site: WordPressSite;
  comparePreset?: AdsReportingAutomationComparePreset;
  compareRanges?: AdsReportingDateRanges;
  adsReportStructure?: AdsReportStructure;
  cachedFiles?: { name: string; content: string }[];
  resumePoint?: AgentRunResumePoint | null;
  signal?: AbortSignal;
  isCancelled?: () => Promise<boolean>;
  onProgress?: (p: AdsReportingPipelineProgress, resumePayload?: Record<string, unknown>) => void | Promise<void>;
  onOutlineReady?: (payload: { outline: AdsReportingOutlineResult; outlineRequestBodyJson: string }) => void;
  onSectionStart?: (index: number) => void;
  onSectionReady?: (row: AdsReportingSectionResult) => void;
};

export type AdsReportingAgentHarnessResult = AdsReportingPipelineResult & {
  files: { name: string; content: string }[];
  comparePreset: AdsReportingAutomationComparePreset;
  compareLabel: string;
  fetchRange: { startDate: string; endDate: string };
  compareFetchRange: { startDate: string; endDate: string };
};

export async function runAdsReportingAgentHarness(
  args: RunAdsReportingAgentHarnessArgs,
): Promise<AdsReportingAgentHarnessResult> {
  const comparePreset = args.comparePreset ?? "mom";
  const reportStructure = args.adsReportStructure ?? "compare";
  const periodProgress = reportStructure === "filter";
  const compareRangeDraft =
    args.compareRanges ?? computeCompareRangesForPreset(comparePreset === "yoy" ? "yoy" : "mom");

  await args.onProgress?.(
    { step: 0, total: 1, label: "Fetching Google Ads…" },
    { phase: "ads_fetch", comparePreset },
  );

  const customerId = await resolveGoogleAdsCustomerIdForReportingAsync(args.site);

  if (await args.isCancelled?.()) throw new Error("Cancelled");

  const compareKind = resolveAdsCompareKind(comparePreset, args.compareRanges, reportStructure);
  const primaryPeriodLabel = formatReportFullDateRange(
    compareRangeDraft.primary.startDate,
    compareRangeDraft.primary.endDate,
  );
  const compareLabelDraft = periodProgress
    ? primaryPeriodLabel
    : `${primaryPeriodLabel} vs ${formatComparePeriodLabel(compareRangeDraft.compare.startDate, compareRangeDraft.compare.endDate)}`;

  const resumePayload = args.resumePoint?.payload ?? {};
  const resumeCachedFiles = Array.isArray(resumePayload.cachedFiles)
    ? (resumePayload.cachedFiles as { name: string; content: string }[])
    : args.cachedFiles;
  const priorSectionResults = Array.isArray(resumePayload.sectionResults)
    ? (resumePayload.sectionResults as AdsReportingSectionResult[])
    : [];
  const savedOutline = resumePayload.outline as AdsReportingOutlineResult | undefined;
  const savedOutlineRequestBodyJson =
    typeof resumePayload.outlineRequestBodyJson === "string" ? resumePayload.outlineRequestBodyJson : undefined;

  let pipelineFiles: { name: string; content: string }[];
  let fetchRange = { startDate: compareRangeDraft.primary.startDate, endDate: compareRangeDraft.primary.endDate };
  let compareFetchRange = {
    startDate: compareRangeDraft.compare.startDate,
    endDate: compareRangeDraft.compare.endDate,
  };

  if (resumeCachedFiles?.length) {
    pipelineFiles = resumeCachedFiles.map((f) => ({ ...f }));
    await args.onProgress?.(
      { step: 0, total: 1, label: formatAdsBundleReadyLabel(pipelineFiles, compareLabelDraft) },
      { phase: "ads_outline", comparePreset },
    );
  } else {
    await args.onProgress?.(
      { step: 0, total: 1, label: formatAdsBundleApiLabel(compareLabelDraft) },
      { phase: "ads_fetch", comparePreset },
    );
    const res = await fetchAdsReportingBundle(customerId, compareRangeDraft, {
      site: args.site,
      siteId: args.site.id,
      compareKind,
      compareLabel: compareLabelDraft,
      reportStructure: adsReportStructureToApi(reportStructure),
    });
    fetchRange = { startDate: res.startDate, endDate: res.endDate };
    compareFetchRange = { startDate: res.compareStartDate, endDate: res.compareEndDate };
    pipelineFiles = res.files;
    await args.onProgress?.(
      { step: 0, total: 1, label: formatAdsBundleReadyLabel(pipelineFiles, compareLabelDraft) },
      { phase: "ads_outline", comparePreset },
    );
  }

  if (await args.isCancelled?.()) throw new Error("Cancelled");

  const apiKey = (await resolveOpenRouterApiKeyForHarness())?.trim();
  if (!apiKey) throw new Error("Add an OpenRouter API key in Settings.");

  await args.onProgress?.(
    { step: 0, total: 1, label: ADS_REPORTING_PROGRESS_LABELS.outlineGenerating },
    { phase: "ads_outline_generating", comparePreset },
  );

  let sectionResultsAcc = [...priorSectionResults];
  let outlineRef = savedOutline;
  const documentTitlePeriod = formatReportingDocumentTitlePeriod({
    structure: periodProgress ? "filter" : "compare",
    primary: fetchRange,
    compare: periodProgress ? undefined : compareFetchRange,
  });
  const result = await runAdsReportingPipeline({
    apiKey,
    model: getAdsModel(args.site.id),
    siteName: args.site.name,
    siteUrl: getPublicSiteUrl(args.site).trim() || (args.site.siteUrl ?? "").trim(),
    files: pipelineFiles,
    compareKind,
    compareLabel: compareLabelDraft,
    documentTitlePeriod,
    signal: args.signal,
    priorSectionResults,
    savedOutline,
    savedOutlineRequestBodyJson,
    onProgress: async (p) => {
      await args.onProgress?.(p, {
        phase: "ads_sections",
        sectionIndex: p.sectionIndex,
        comparePreset,
        outline: outlineRef,
        sectionResults: sectionResultsAcc,
      });
    },
    onOutlineReady: (payload) => {
      outlineRef = payload.outline;
      args.onOutlineReady?.(payload);
    },
    onSectionStart: (index) => args.onSectionStart?.(index),
    onSectionReady: (row) => {
      sectionResultsAcc = [...sectionResultsAcc.filter((entry) => entry.index !== row.index), row].sort(
        (a, b) => a.index - b.index,
      );
      args.onSectionReady?.(row);
    },
  });

  return {
    ...result,
    files: pipelineFiles,
    comparePreset,
    compareLabel: periodProgress
      ? formatReportFullDateRange(fetchRange.startDate, fetchRange.endDate)
      : `${formatReportFullDateRange(fetchRange.startDate, fetchRange.endDate)} vs ${formatComparePeriodLabel(compareFetchRange.startDate, compareFetchRange.endDate)}`,
    fetchRange,
    compareFetchRange,
  };
}
