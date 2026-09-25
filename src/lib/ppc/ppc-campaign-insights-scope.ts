import type { AdsMetrics } from "@/lib/ads-reporting/ads-reporting-types";
import type { PpcCampaign } from "@/lib/ppc/google-ads-types";
import type {
  PpcCampaignInsights,
  PpcCampaignInsightsDailyPoint,
  PpcCampaignStructureAdGroup,
} from "@/lib/ppc/ppc-campaign-insights-types";

export type PpcInsightsScope =
  | { level: "campaign" }
  | { level: "ad_group"; adGroupId: string; label: string }
  | { level: "ad"; adGroupId: string; adId: string; label: string }
  | { level: "keyword"; adGroupId: string; keywordText: string; label: string };

export type PpcInsightsScopeView = {
  scopeLabel: string;
  dailySeries: PpcCampaignInsightsDailyPoint[];
  summary: AdsMetrics;
  hasActivity: boolean;
  missingSeries: boolean;
};

export function ppcKeywordDailySeriesKey(adGroupId: string, keywordText: string): string {
  return `${adGroupId.trim()}|${keywordText.trim()}`;
}

export function ppcAdDailySeriesKey(adGroupId: string, adId: string): string {
  return `${adGroupId.trim()}|${adId.trim()}`;
}

export function parsePpcAdDailySeriesKey(key: string): { adGroupId: string; adId: string } | null {
  const idx = key.indexOf("|");
  if (idx <= 0) return null;
  const adGroupId = key.slice(0, idx).trim();
  const adId = key.slice(idx + 1).trim();
  if (!adGroupId || !adId) return null;
  return { adGroupId, adId };
}

export function sumPpcInsightsDailySeries(points: PpcCampaignInsightsDailyPoint[]): AdsMetrics {
  let impressions = 0;
  let clicks = 0;
  let costMicros = 0;
  let conversions = 0;
  let conversionsValue = 0;
  for (const point of points) {
    impressions += point.impressions;
    clicks += point.clicks;
    costMicros += point.costMicros;
    conversions += point.conversions;
    conversionsValue += point.conversionsValue;
  }
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const averageCpc = clicks > 0 ? costMicros / clicks : 0;
  return {
    impressions,
    clicks,
    costMicros,
    ctr,
    averageCpc,
    conversions,
    conversionsValue,
  };
}

function seriesHasActivity(points: PpcCampaignInsightsDailyPoint[]): boolean {
  return points.some(
    (p) => p.impressions > 0 || p.clicks > 0 || p.costMicros > 0 || p.conversions > 0,
  );
}

export function resolvePpcInsightsScopeView(
  insights: PpcCampaignInsights,
  scope: PpcInsightsScope,
): PpcInsightsScopeView {
  if (scope.level === "campaign") {
    const dailySeries = insights.dailySeries;
    return {
      scopeLabel: "Campaign",
      dailySeries,
      summary: insights.summary,
      hasActivity: seriesHasActivity(dailySeries),
      missingSeries: false,
    };
  }

  if (scope.level === "ad_group") {
    const dailySeries = insights.adGroupDailySeriesById[scope.adGroupId] ?? [];
    const summary = sumPpcInsightsDailySeries(dailySeries);
    return {
      scopeLabel: `Ad group: ${scope.label}`,
      dailySeries,
      summary,
      hasActivity: seriesHasActivity(dailySeries),
      missingSeries: dailySeries.length === 0,
    };
  }

  if (scope.level === "ad") {
    const key = ppcAdDailySeriesKey(scope.adGroupId, scope.adId);
    const dailySeries = insights.adDailySeriesByKey[key] ?? [];
    const summary = sumPpcInsightsDailySeries(dailySeries);
    return {
      scopeLabel: `Ad: ${scope.label}`,
      dailySeries,
      summary,
      hasActivity: seriesHasActivity(dailySeries),
      missingSeries: dailySeries.length === 0,
    };
  }

  const key = ppcKeywordDailySeriesKey(scope.adGroupId, scope.keywordText);
  const dailySeries = insights.keywordDailySeriesByKey[key] ?? [];
  const summary = sumPpcInsightsDailySeries(dailySeries);
  return {
    scopeLabel: `Keyword: ${scope.label}`,
    dailySeries,
    summary,
    hasActivity: seriesHasActivity(dailySeries),
    missingSeries: dailySeries.length === 0,
  };
}

export const PPC_INSIGHTS_SCOPE_CAMPAIGN: PpcInsightsScope = { level: "campaign" };

export function resolvePpcAdGroupIdForIndex(
  agIndex: number,
  campaign: PpcCampaign | undefined,
  structureAdGroups: PpcCampaignStructureAdGroup[],
): string {
  const fromCampaign = campaign?.adGroups[agIndex]?.id?.trim();
  if (fromCampaign) return fromCampaign;
  const fromStructure = structureAdGroups[agIndex]?.id?.trim();
  if (fromStructure) return fromStructure;
  const name = campaign?.adGroups[agIndex]?.name?.trim() ?? structureAdGroups[agIndex]?.name?.trim();
  if (name) {
    const match = structureAdGroups.find((row) => row.name === name);
    if (match?.id) return match.id;
  }
  return "";
}

export function buildPpcInsightsScopeFromRowFocus(input: {
  openAdGroupIndex: number | null;
  focusedKeyword: { agIndex: number; text: string } | null;
  selectedLiveAd: { adGroupId: string; adId: string; label: string } | null;
  campaign: PpcCampaign | undefined;
  structureAdGroups: PpcCampaignStructureAdGroup[];
}): PpcInsightsScope {
  const structure = input.structureAdGroups;

  if (input.selectedLiveAd?.adId.trim()) {
    return {
      level: "ad",
      adGroupId: input.selectedLiveAd.adGroupId,
      adId: input.selectedLiveAd.adId,
      label: input.selectedLiveAd.label,
    };
  }

  if (input.focusedKeyword?.text.trim()) {
    const agIndex = input.focusedKeyword.agIndex;
    const adGroupId = resolvePpcAdGroupIdForIndex(agIndex, input.campaign, structure);
    const label = input.focusedKeyword.text.trim();
    return { level: "keyword", adGroupId, keywordText: label, label };
  }

  if (input.openAdGroupIndex !== null) {
    const agIndex = input.openAdGroupIndex;
    const adGroupId = resolvePpcAdGroupIdForIndex(agIndex, input.campaign, structure);
    const label =
      input.campaign?.adGroups[agIndex]?.name?.trim() ??
      structure[agIndex]?.name?.trim() ??
      `Ad group ${agIndex + 1}`;
    return { level: "ad_group", adGroupId, label };
  }

  return PPC_INSIGHTS_SCOPE_CAMPAIGN;
}

export function keywordLineFromTextareaValue(value: string, selectionStart: number): string {
  const before = value.slice(0, Math.max(0, selectionStart));
  const lineIndex = before.split("\n").length - 1;
  const lines = value.split("\n");
  return (lines[lineIndex] ?? "").trim();
}
