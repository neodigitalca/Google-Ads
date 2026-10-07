import {
  computeCompareRangesForPreset,
  computeTrailingFullMonthsCompareRanges,
  isTrailingMonthsPreset,
  parseTrailingMonthCount,
  type ReportingComparePresetId,
} from "@/lib/reporting/reporting-date-presets";
import type { AdsReportStructure, AdsReportingDateRanges } from "@/lib/ads-reporting/ads-reporting-types";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

export type AdsReportingAutomationComparePreset = "mom" | "yoy";

export function defaultAdsReportingExecutionPayload(): TaskExecutionPayload {
  return {
    comparePreset: "mom",
    gscComparePresetId: "mom",
    gscTrailingMonthCount: 1,
    saveToDisk: true,
  };
}

function resolveAdsComparePresetId(
  payload?: Pick<TaskExecutionPayload, "gscComparePresetId" | "comparePreset"> | null,
): ReportingComparePresetId {
  const presetId = payload?.gscComparePresetId?.trim();
  if (presetId === "yoy" || presetId === "custom_compare") return presetId;
  if (presetId && isTrailingMonthsPreset(presetId)) return presetId;
  if (payload?.comparePreset === "yoy") return "yoy";
  return "mom";
}

function comparePresetIdForTrailingCount(monthCount: number): ReportingComparePresetId {
  if (monthCount === 1) return "mom";
  if (monthCount === 3) return "m3";
  if (monthCount === 6) return "m6";
  if (monthCount === 12) return "m12";
  return "custom_compare";
}

export function resolveAdsReportStructure(
  payload?: Pick<TaskExecutionPayload, "adsReportStructure" | "gscReportStructure"> | null,
): AdsReportStructure {
  if (payload?.adsReportStructure === "filter" || payload?.adsReportStructure === "compare") {
    return payload.adsReportStructure;
  }
  return payload?.gscReportStructure === "period_progress" ? "filter" : "compare";
}

export function resolveAdsReportingRunConfig(
  payload?: TaskExecutionPayload | Record<string, unknown> | null,
): {
  comparePreset: AdsReportingAutomationComparePreset;
  compareRanges?: AdsReportingDateRanges;
  presetId: ReportingComparePresetId;
  adsReportStructure: AdsReportStructure;
} {
  const typed = (payload ?? {}) as TaskExecutionPayload;
  const adsReportStructure = resolveAdsReportStructure(typed);
  const trailingCount = parseTrailingMonthCount(String(typed.gscTrailingMonthCount ?? ""));
  if (trailingCount != null) {
    const presetId = comparePresetIdForTrailingCount(trailingCount);
    if (trailingCount === 1) {
      return { comparePreset: "mom", presetId, adsReportStructure };
    }
    return {
      comparePreset: "mom",
      compareRanges: computeTrailingFullMonthsCompareRanges(trailingCount) as AdsReportingDateRanges,
      presetId,
      adsReportStructure,
    };
  }
  const presetId = resolveAdsComparePresetId(typed);
  const comparePreset: AdsReportingAutomationComparePreset = presetId === "yoy" ? "yoy" : "mom";
  if (presetId === "custom_compare" && typed.gscCompareRanges) {
    return {
      comparePreset,
      compareRanges: typed.gscCompareRanges as AdsReportingDateRanges,
      presetId,
      adsReportStructure,
    };
  }
  if (isTrailingMonthsPreset(presetId)) {
    return {
      comparePreset,
      compareRanges: computeCompareRangesForPreset(presetId) as AdsReportingDateRanges,
      presetId,
      adsReportStructure,
    };
  }
  return { comparePreset, presetId, adsReportStructure };
}
