import { microsToSpend } from "@/lib/ads-reporting/ads-reporting-metrics";
import type { AdsMetrics } from "@/lib/ads-reporting/ads-reporting-types";
import type { PpcCampaignInsights } from "@/lib/ppc/ppc-campaign-insights-types";

export function ppcCampaignInsightsDateRangeLabel(insights: PpcCampaignInsights): string {
  return `${insights.startDate} to ${insights.endDate}`;
}

export function ppcCampaignStatusLabel(status: string | undefined): string {
  const key = (status ?? "").trim().toUpperCase();
  if (key === "ENABLED") return "Enabled";
  if (key === "PAUSED") return "Paused";
  if (key === "REMOVED") return "Removed";
  if (key === "") return "Unknown";
  return key.charAt(0) + key.slice(1).toLowerCase();
}

export function ppcCampaignStatusTone(
  status: string | undefined,
): "muted" | "warn" | "ok" {
  const key = (status ?? "").trim().toUpperCase();
  if (key === "ENABLED") return "ok";
  if (key === "PAUSED") return "warn";
  return "muted";
}

export function ppcCampaignInsightsPerformanceKeywords(insights: PpcCampaignInsights, limit = 10) {
  return insights.keywords
    .filter((row) => row.impressions > 0 || row.clicks > 0)
    .slice(0, limit);
}

export function ppcCampaignInsightsPerformanceSearchTerms(insights: PpcCampaignInsights, limit = 10) {
  return insights.searchTerms
    .filter((row) => row.impressions > 0 || row.clicks > 0)
    .slice(0, limit);
}

export function ppcCampaignInsightsPerformanceAdGroups(insights: PpcCampaignInsights, limit = 10) {
  return insights.adGroups
    .filter((row) => row.impressions > 0 || row.clicks > 0)
    .slice(0, limit);
}

export function ppcCampaignInsightsAverageCpcMicros(row: AdsMetrics): number {
  if (row.averageCpc > 0) return row.averageCpc;
  if (row.clicks > 0 && row.costMicros > 0) return row.costMicros / row.clicks;
  return 0;
}

export function ppcCampaignInsightsCpcLabel(averageCpcMicros: number): string {
  if (averageCpcMicros <= 0) return "—";
  return microsToSpend(averageCpcMicros).toFixed(2);
}

/** Compact stats for keyword, ad group, and search term rows (same date range as campaign summary). */
export function ppcCampaignInsightsTrafficStatsLabel(row: AdsMetrics): string {
  const parts = [`${row.clicks} clk`, `${row.impressions} imp`];
  if (row.costMicros > 0) {
    parts.push(`$${microsToSpend(row.costMicros).toFixed(2)}`);
  }
  const cpcMicros = ppcCampaignInsightsAverageCpcMicros(row);
  if (cpcMicros > 0) {
    parts.push(`CPC $${ppcCampaignInsightsCpcLabel(cpcMicros)}`);
  }
  return parts.join(" · ");
}
