import type { WordPressSite } from "@/components/integrations/types";
import { fetchWordPressSitesMirror } from "@/components/integrations/storage";
import { IN_THE_SHADE_GOOGLE_ADS_CUSTOMER_ID } from "@/lib/neo-digital-google-ads-customer-ids";

export { IN_THE_SHADE_GOOGLE_ADS_CUSTOMER_ID };

export function normalizeGoogleAdsCustomerId(raw: string): string {
  return raw.replace(/\D+/g, "");
}

/** Google Ads customer ID from the property only (browser copy). */
export function resolveGoogleAdsCustomerIdForReporting(site: WordPressSite): string {
  return normalizeGoogleAdsCustomerId(site.googleAdsCustomerId?.trim() ?? "");
}

/** Same site id on server property mirror (sites.json) when the browser copy is empty. */
export async function resolveGoogleAdsCustomerIdForReportingAsync(site: WordPressSite): Promise<string> {
  const direct = resolveGoogleAdsCustomerIdForReporting(site);
  if (direct.length === 10) return direct;
  const siteId = site.id?.trim();
  if (!siteId) return "";
  const serverSites = await fetchWordPressSitesMirror();
  const row = serverSites.find((s) => s.id === siteId);
  return normalizeGoogleAdsCustomerId(row?.googleAdsCustomerId?.trim() ?? "");
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
