import type { PpcCampaignInsights } from "@/lib/ppc/ppc-campaign-insights-types";

const KEYWORD_CAP = 15;
const SEARCH_TERM_CAP = 15;

export type PpcCampaignLiveInsightsPrompt = {
  campaignId: string;
  dateRange: { startDate: string; endDate: string };
  summary: {
    impressions: number;
    clicks: number;
    costMicros: number;
    conversions: number;
  };
  campaignKeywords: Array<{ text: string; source: "campaign_live"; clicks: number }>;
  campaignSearchTerms: Array<{ text: string; source: "campaign_live"; clicks: number }>;
};

export function ppcCampaignInsightsForPrompt(
  insights: PpcCampaignInsights | undefined,
): PpcCampaignLiveInsightsPrompt | undefined {
  if (!insights) return undefined;

  const campaignKeywords = insights.keywords
    .slice(0, KEYWORD_CAP)
    .map((row) => ({
      text: row.text,
      source: "campaign_live" as const,
      clicks: row.clicks,
    }))
    .filter((row) => row.text);

  const campaignSearchTerms = insights.searchTerms
    .slice(0, SEARCH_TERM_CAP)
    .map((row) => ({
      text: row.searchTerm,
      source: "campaign_live" as const,
      clicks: row.clicks,
    }))
    .filter((row) => row.text);

  if (campaignKeywords.length === 0 && campaignSearchTerms.length === 0 && insights.summary.clicks === 0) {
    return {
      campaignId: insights.campaignId,
      dateRange: { startDate: insights.startDate, endDate: insights.endDate },
      summary: {
        impressions: insights.summary.impressions,
        clicks: insights.summary.clicks,
        costMicros: insights.summary.costMicros,
        conversions: insights.summary.conversions,
      },
      campaignKeywords: [],
      campaignSearchTerms: [],
    };
  }

  return {
    campaignId: insights.campaignId,
    dateRange: { startDate: insights.startDate, endDate: insights.endDate },
    summary: {
      impressions: insights.summary.impressions,
      clicks: insights.summary.clicks,
      costMicros: insights.summary.costMicros,
      conversions: insights.summary.conversions,
    },
    campaignKeywords,
    campaignSearchTerms,
  };
}
