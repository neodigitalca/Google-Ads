export type PpcGoogleResearchSignalSource =
  | "gsc"
  | "dfs_labs"
  | "dfs_google_ads"
  | "ads_account"
  | "serp_paid";

export type PpcGoogleResearchSignalItem = {
  text: string;
  source?: PpcGoogleResearchSignalSource;
  volume?: number;
  cpc?: number;
  clicks?: number;
  impressions?: number;
  title?: string;
  description?: string;
  url?: string;
};

export type PpcGoogleResearchSignals = {
  focusKeyword: string;
  locationName: string;
  languageCode: string;
  landingPageUrls: string[];
  gscQueries: PpcGoogleResearchSignalItem[];
  dfsKeywordIdeas: PpcGoogleResearchSignalItem[];
  dfsGoogleAdsKeywords: PpcGoogleResearchSignalItem[];
  accountKeywords: PpcGoogleResearchSignalItem[];
  accountSearchTerms: PpcGoogleResearchSignalItem[];
  serpPaidAds: PpcGoogleResearchSignalItem[];
};

const LIST_CAPS: Record<
  | "gscQueries"
  | "dfsKeywordIdeas"
  | "dfsGoogleAdsKeywords"
  | "accountKeywords"
  | "accountSearchTerms"
  | "serpPaidAds",
  number
> = {
  gscQueries: 30,
  dfsKeywordIdeas: 30,
  dfsGoogleAdsKeywords: 30,
  accountKeywords: 20,
  accountSearchTerms: 20,
  serpPaidAds: 10,
};

function normalizeItem(raw: unknown, fallbackSource?: PpcGoogleResearchSignalSource): PpcGoogleResearchSignalItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const text = typeof row.text === "string" ? row.text.trim() : "";
  if (!text) return null;
  const source = typeof row.source === "string" ? (row.source as PpcGoogleResearchSignalSource) : fallbackSource;
  const item: PpcGoogleResearchSignalItem = { text, source };
  if (typeof row.volume === "number" && Number.isFinite(row.volume)) item.volume = row.volume;
  if (typeof row.cpc === "number" && Number.isFinite(row.cpc)) item.cpc = row.cpc;
  if (typeof row.clicks === "number" && Number.isFinite(row.clicks)) item.clicks = row.clicks;
  if (typeof row.impressions === "number" && Number.isFinite(row.impressions)) item.impressions = row.impressions;
  if (typeof row.title === "string" && row.title.trim()) item.title = row.title.trim();
  if (typeof row.description === "string" && row.description.trim()) item.description = row.description.trim();
  if (typeof row.url === "string" && row.url.trim()) item.url = row.url.trim();
  return item;
}

function dedupeItems(items: PpcGoogleResearchSignalItem[], limit: number): PpcGoogleResearchSignalItem[] {
  const seen = new Set<string>();
  const out: PpcGoogleResearchSignalItem[] = [];
  for (const item of items) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeList(
  raw: unknown,
  key: keyof typeof LIST_CAPS,
  fallbackSource?: PpcGoogleResearchSignalSource,
): PpcGoogleResearchSignalItem[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw
    .map((row) => normalizeItem(row, fallbackSource))
    .filter((row): row is PpcGoogleResearchSignalItem => row !== null);
  return dedupeItems(parsed, LIST_CAPS[key]);
}

export function normalizePpcGoogleResearchSignals(raw: unknown): PpcGoogleResearchSignals {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const focusKeyword = typeof root.focusKeyword === "string" ? root.focusKeyword.trim() : "";
  if (!focusKeyword) {
    throw new Error("PPC research signals missing focusKeyword.");
  }
  const landingPageUrls = Array.isArray(root.landingPageUrls)
    ? root.landingPageUrls.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
    : [];

  return {
    focusKeyword,
    locationName: typeof root.locationName === "string" && root.locationName.trim() ? root.locationName.trim() : "United States",
    languageCode: typeof root.languageCode === "string" && root.languageCode.trim() ? root.languageCode.trim() : "en",
    landingPageUrls,
    gscQueries: normalizeList(root.gscQueries, "gscQueries", "gsc"),
    dfsKeywordIdeas: normalizeList(root.dfsKeywordIdeas, "dfsKeywordIdeas", "dfs_labs"),
    dfsGoogleAdsKeywords: normalizeList(root.dfsGoogleAdsKeywords, "dfsGoogleAdsKeywords", "dfs_google_ads"),
    accountKeywords: normalizeList(root.accountKeywords, "accountKeywords", "ads_account"),
    accountSearchTerms: normalizeList(root.accountSearchTerms, "accountSearchTerms", "ads_account"),
    serpPaidAds: normalizeList(root.serpPaidAds, "serpPaidAds", "serp_paid"),
  };
}

export function ppcResearchSignalsForPrompt(signals: PpcGoogleResearchSignals) {
  return {
    focusKeyword: signals.focusKeyword,
    locationName: signals.locationName,
    languageCode: signals.languageCode,
    gscQueries: signals.gscQueries,
    dfsKeywordIdeas: signals.dfsKeywordIdeas,
    dfsGoogleAdsKeywords: signals.dfsGoogleAdsKeywords,
    accountKeywords: signals.accountKeywords,
    accountSearchTerms: signals.accountSearchTerms,
    serpPaidAds: signals.serpPaidAds,
  };
}

export function ppcResearchKeywordUnion(signals: PpcGoogleResearchSignals): string[] {
  const items = [
    ...signals.gscQueries,
    ...signals.dfsKeywordIdeas,
    ...signals.dfsGoogleAdsKeywords,
    ...signals.accountKeywords,
    ...signals.accountSearchTerms,
  ];
  return dedupeItems(items, 60).map((i) => i.text);
}
