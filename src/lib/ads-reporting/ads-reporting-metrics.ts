export function normalizeGoogleAdsCustomerId(raw: string): string {
  return raw.replace(/\D+/g, "");
}

export function formatGoogleAdsCustomerId(raw: string): string {
  const id = normalizeGoogleAdsCustomerId(raw);
  if (id.length !== 10) return id;
  return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;
}

export function googleAdsAccountUrl(customerId: string, loginCustomerId?: string): string | null {
  const id = normalizeGoogleAdsCustomerId(customerId);
  if (id.length !== 10) return null;
  const url = new URL("https://ads.google.com/aw/campaigns");
  url.searchParams.set("__c", id);
  const login = loginCustomerId ? normalizeGoogleAdsCustomerId(loginCustomerId) : "";
  if (login.length === 10) url.searchParams.set("__u", login);
  return url.toString();
}

export function googleAdsCampaignUrl(
  customerId: string,
  campaignId: string,
  loginCustomerId?: string,
): string | null {
  const id = normalizeGoogleAdsCustomerId(customerId);
  const campId = (campaignId ?? "").trim();
  if (id.length !== 10 || !campId) return null;
  const url = new URL("https://ads.google.com/aw/campaigns");
  url.searchParams.set("__c", id);
  url.searchParams.set("campaignId", campId);
  const login = loginCustomerId ? normalizeGoogleAdsCustomerId(loginCustomerId) : "";
  if (login.length === 10) url.searchParams.set("__u", login);
  return url.toString();
}

export function microsToSpend(costMicros: number): number {
  return costMicros / 1_000_000;
}

export function adsCpa(costMicros: number, conversions: number): number | null {
  if (conversions <= 0) return null;
  return microsToSpend(costMicros) / conversions;
}

export function adsPctDelta(primary: number, compare: number): number | null {
  if (compare === 0) return null;
  return ((primary - compare) / compare) * 100;
}
