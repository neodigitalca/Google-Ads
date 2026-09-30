import type { AdsKeywordRow, AdsMetrics, AdsSearchTermRow } from "@/lib/ads-reporting/ads-reporting-types";

export type PpcCampaignInsightsDailyPoint = {
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
};

export type PpcCampaignInsightsAdGroupRow = AdsMetrics & {
  id: string;
  name: string;
};

export type PpcCampaignStructureAdGroup = {
  id: string;
  name: string;
  status: string;
};

export type PpcCampaignStructureAd = {
  adGroupId: string;
  adGroupName: string;
  adId: string;
  status: string;
  label: string;
};

export type PpcCampaignRecommendationImpact = {
  baseClicks: number;
  potentialClicks: number;
  baseCostMicros: number;
};

export type PpcCampaignRecommendation = {
  type: string;
  resourceName: string;
  title: string;
  detail: string;
  adGroupId?: string;
  keywordText?: string;
  impact?: PpcCampaignRecommendationImpact;
};

export type PpcCampaignInsights = {
  customerId: string;
  campaignId: string;
  campaignName?: string;
  campaignStatus?: string;
  dailyBudgetMicros?: number;
  structureAdGroups: PpcCampaignStructureAdGroup[];
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
  summary: AdsMetrics;
  compareSummary?: AdsMetrics;
  dailySeries: PpcCampaignInsightsDailyPoint[];
  adGroupDailySeriesById: Record<string, PpcCampaignInsightsDailyPoint[]>;
  keywordDailySeriesByKey: Record<string, PpcCampaignInsightsDailyPoint[]>;
  adDailySeriesByKey: Record<string, PpcCampaignInsightsDailyPoint[]>;
  structureAds: PpcCampaignStructureAd[];
  keywords: AdsKeywordRow[];
  searchTerms: AdsSearchTermRow[];
  adGroups: PpcCampaignInsightsAdGroupRow[];
  recommendations: PpcCampaignRecommendation[];
};

const KEYWORD_CAP = 100;
const SEARCH_TERM_CAP = 100;
const AD_GROUP_CAP = 50;
const DAILY_CAP = 366;
const RECOMMENDATION_CAP = 50;
const SCOPED_DAILY_KEY_CAP = 40;

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function metricsFromRaw(raw: unknown): AdsMetrics {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    costMicros: num(row.costMicros),
    ctr: num(row.ctr),
    averageCpc: num(row.averageCpc),
    conversions: num(row.conversions),
    conversionsValue: num(row.conversionsValue),
  };
}

function dailyFromRaw(raw: unknown): PpcCampaignInsightsDailyPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const date = typeof row.date === "string" ? row.date.trim() : "";
  if (!date) return null;
  return {
    date,
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    costMicros: num(row.costMicros),
    conversions: num(row.conversions),
    conversionsValue: num(row.conversionsValue),
  };
}

function keywordFromRaw(raw: unknown): AdsKeywordRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const text = typeof row.text === "string" ? row.text.trim() : "";
  if (!text) return null;
  return {
    ...metricsFromRaw(row),
    text,
    matchType: typeof row.matchType === "string" ? row.matchType : "",
    campaignName: typeof row.campaignName === "string" ? row.campaignName : "",
    adGroupName: typeof row.adGroupName === "string" ? row.adGroupName : "",
  };
}

function searchTermFromRaw(raw: unknown): AdsSearchTermRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const searchTerm = typeof row.searchTerm === "string" ? row.searchTerm.trim() : "";
  if (!searchTerm) return null;
  return {
    ...metricsFromRaw(row),
    searchTerm,
    campaignName: typeof row.campaignName === "string" ? row.campaignName : "",
  };
}

function dailySeriesMapFromRaw(raw: unknown): Record<string, PpcCampaignInsightsDailyPoint[]> {
  const out: Record<string, PpcCampaignInsightsDailyPoint[]> = {};
  if (!raw || typeof raw !== "object") return out;
  const body = raw as Record<string, unknown>;
  let keyCount = 0;
  for (const [key, value] of Object.entries(body)) {
    if (keyCount >= SCOPED_DAILY_KEY_CAP) break;
    if (!Array.isArray(value)) continue;
    const points: PpcCampaignInsightsDailyPoint[] = [];
    for (const item of value) {
      const point = dailyFromRaw(item);
      if (point) points.push(point);
      if (points.length >= DAILY_CAP) break;
    }
    if (points.length > 0) {
      out[key] = points;
      keyCount += 1;
    }
  }
  return out;
}

function recommendationFromRaw(raw: unknown): PpcCampaignRecommendation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const type = typeof row.type === "string" ? row.type.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!type || !title) return null;
  const detail = typeof row.detail === "string" ? row.detail.trim() : title;
  const resourceName = typeof row.resourceName === "string" ? row.resourceName : "";
  const adGroupId =
    typeof row.adGroupId === "string" && row.adGroupId.trim() ? row.adGroupId.trim() : undefined;
  const keywordText =
    typeof row.keywordText === "string" && row.keywordText.trim() ? row.keywordText.trim() : undefined;
  let impact: PpcCampaignRecommendationImpact | undefined;
  if (row.impact && typeof row.impact === "object") {
    const imp = row.impact as Record<string, unknown>;
    impact = {
      baseClicks: num(imp.baseClicks),
      potentialClicks: num(imp.potentialClicks),
      baseCostMicros: num(imp.baseCostMicros),
    };
  }
  return { type, resourceName, title, detail, adGroupId, keywordText, impact };
}

function adGroupFromRaw(raw: unknown): PpcCampaignInsightsAdGroupRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  return {
    ...metricsFromRaw(row),
    id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
    name,
  };
}

export function ppcCampaignInsightsLast30DayRange(reference: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const end = new Date(reference);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: fmt(start), endDate: fmt(end) };
}

export function normalizePpcCampaignInsights(raw: unknown): PpcCampaignInsights {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid campaign insights payload.");
  }
  const body = raw as Record<string, unknown>;
  const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
  const campaignId = typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  const startDate = typeof body.startDate === "string" ? body.startDate.trim() : "";
  const endDate = typeof body.endDate === "string" ? body.endDate.trim() : "";
  if (!customerId || !campaignId || !startDate || !endDate) {
    throw new Error("Campaign insights missing customerId, campaignId, or date range.");
  }

  const dailySeries: PpcCampaignInsightsDailyPoint[] = [];
  if (Array.isArray(body.dailySeries)) {
    for (const item of body.dailySeries) {
      const point = dailyFromRaw(item);
      if (point) dailySeries.push(point);
      if (dailySeries.length >= DAILY_CAP) break;
    }
  }

  const keywords: AdsKeywordRow[] = [];
  if (Array.isArray(body.keywords)) {
    for (const item of body.keywords) {
      const row = keywordFromRaw(item);
      if (row) keywords.push(row);
      if (keywords.length >= KEYWORD_CAP) break;
    }
  }

  const searchTerms: AdsSearchTermRow[] = [];
  if (Array.isArray(body.searchTerms)) {
    for (const item of body.searchTerms) {
      const row = searchTermFromRaw(item);
      if (row) searchTerms.push(row);
      if (searchTerms.length >= SEARCH_TERM_CAP) break;
    }
  }

  const adGroups: PpcCampaignInsightsAdGroupRow[] = [];
  if (Array.isArray(body.adGroups)) {
    for (const item of body.adGroups) {
      const row = adGroupFromRaw(item);
      if (row) adGroups.push(row);
      if (adGroups.length >= AD_GROUP_CAP) break;
    }
  }

  const campaignName =
    typeof body.campaignName === "string" && body.campaignName.trim() ? body.campaignName.trim() : undefined;
  const campaignStatus =
    typeof body.campaignStatus === "string" && body.campaignStatus.trim()
      ? body.campaignStatus.trim()
      : undefined;
  const dailyBudgetMicros =
    typeof body.dailyBudgetMicros === "number" && Number.isFinite(body.dailyBudgetMicros)
      ? body.dailyBudgetMicros
      : undefined;

  const structureAds: PpcCampaignStructureAd[] = [];
  if (Array.isArray(body.structureAds)) {
    for (const item of body.structureAds) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const adId = typeof row.adId === "string" ? row.adId.trim() : "";
      const adGroupId = typeof row.adGroupId === "string" ? row.adGroupId.trim() : "";
      const label = typeof row.label === "string" ? row.label.trim() : "";
      if (!adId || !adGroupId || !label) continue;
      structureAds.push({
        adGroupId,
        adGroupName: typeof row.adGroupName === "string" ? row.adGroupName : "",
        adId,
        status: typeof row.status === "string" ? row.status : "",
        label,
      });
    }
  }

  const structureAdGroups: PpcCampaignStructureAdGroup[] = [];
  if (Array.isArray(body.structureAdGroups)) {
    for (const item of body.structureAdGroups) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) continue;
      structureAdGroups.push({
        id: typeof row.id === "string" ? row.id : String(row.id ?? ""),
        name,
        status: typeof row.status === "string" ? row.status : "",
      });
    }
  }

  const recommendations: PpcCampaignRecommendation[] = [];
  if (Array.isArray(body.recommendations)) {
    for (const item of body.recommendations) {
      const row = recommendationFromRaw(item);
      if (row) recommendations.push(row);
      if (recommendations.length >= RECOMMENDATION_CAP) break;
    }
  }

  const out: PpcCampaignInsights = {
    customerId,
    campaignId,
    campaignName,
    campaignStatus,
    dailyBudgetMicros,
    structureAdGroups,
    startDate,
    endDate,
    summary: metricsFromRaw(body.summary),
    dailySeries,
    adGroupDailySeriesById: dailySeriesMapFromRaw(body.adGroupDailySeriesById),
    keywordDailySeriesByKey: dailySeriesMapFromRaw(body.keywordDailySeriesByKey),
    adDailySeriesByKey: dailySeriesMapFromRaw(body.adDailySeriesByKey),
    structureAds,
    keywords: keywords.filter((row) => row.impressions > 0 || row.clicks > 0),
    searchTerms: searchTerms.filter((row) => row.impressions > 0 || row.clicks > 0),
    adGroups: adGroups.filter((row) => row.impressions > 0 || row.clicks > 0),
    recommendations,
  };

  const compareStart = typeof body.compareStartDate === "string" ? body.compareStartDate.trim() : "";
  const compareEnd = typeof body.compareEndDate === "string" ? body.compareEndDate.trim() : "";
  if (compareStart && compareEnd) {
    out.compareStartDate = compareStart;
    out.compareEndDate = compareEnd;
    out.compareSummary = metricsFromRaw(body.compareSummary);
  }

  return out;
}

export function ppcCampaignInsightsHasActivity(insights: PpcCampaignInsights): boolean {
  const s = insights.summary;
  return s.impressions > 0 || s.clicks > 0 || s.costMicros > 0 || s.conversions > 0;
}
