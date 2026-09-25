import { normalizeGoogleAdsCustomerId } from "@/lib/ads-reporting/ads-reporting-metrics";
import {
  GOOGLE_ADS_CAMPAIGN_NAME_MAX,
  GOOGLE_ADS_KEYWORD_MAX,
  GOOGLE_ADS_RSA_DESCRIPTION_MAX,
  GOOGLE_ADS_RSA_HEADLINE_MAX,
  GOOGLE_ADS_RSA_PATH_MAX,
  googleAdsCharCountOver,
} from "@/lib/ppc/google-ads-field-limits";
import type { PpcCampaign, PpcCampaignRow, PpcResponsiveSearchAd } from "@/lib/ppc/google-ads-types";
import { resolvePpcRowCampaignName } from "@/lib/ppc/google-ads-types";

export const GOOGLE_ADS_PUBLISH_MIN_DAILY_BUDGET = 1;
export const GOOGLE_ADS_PUBLISH_MIN_HEADLINES = 3;
export const GOOGLE_ADS_PUBLISH_MIN_DESCRIPTIONS = 2;

export type GoogleAdsPublishCampaignBody = {
  customerId: string;
  dailyBudget: number;
  campaign: PpcCampaign;
};

export type GoogleAdsSyncCampaignBody = GoogleAdsPublishCampaignBody & {
  campaignId: string;
};

export function collectGoogleAdsPublishRows(rows: PpcCampaignRow[]): PpcCampaignRow[] {
  return rows.filter((row) => row.status === "ready" && row.campaign && !row.adsCampaignId?.trim());
}

export function collectGoogleAdsSyncRows(rows: PpcCampaignRow[]): PpcCampaignRow[] {
  return rows.filter((row) => row.status === "ready" && row.campaign && Boolean(row.adsCampaignId?.trim()));
}

export function resolvePpcRowDailyBudget(row: PpcCampaignRow): number | null {
  if (typeof row.dailyBudget !== "number" || !Number.isFinite(row.dailyBudget)) return null;
  return row.dailyBudget;
}

function trimmedNonEmpty(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
}

function assertMaxChars(label: string, value: string, max: number): void {
  const text = value.trim();
  if (text && googleAdsCharCountOver(text, max)) {
    throw new Error(`${label} is too long (max ${max} characters): ${text}`);
  }
}

function assertPublishableAd(ad: PpcResponsiveSearchAd, adGroupName: string): void {
  const headlines = trimmedNonEmpty(ad.headlines);
  if (headlines.length < GOOGLE_ADS_PUBLISH_MIN_HEADLINES) {
    throw new Error(
      `${adGroupName}: each responsive search ad needs at least ${GOOGLE_ADS_PUBLISH_MIN_HEADLINES} headlines.`,
    );
  }
  for (const headline of headlines) {
    assertMaxChars(`${adGroupName}: headline`, headline, GOOGLE_ADS_RSA_HEADLINE_MAX);
  }
  const descriptions = trimmedNonEmpty(ad.descriptions);
  if (descriptions.length < GOOGLE_ADS_PUBLISH_MIN_DESCRIPTIONS) {
    throw new Error(
      `${adGroupName}: each responsive search ad needs at least ${GOOGLE_ADS_PUBLISH_MIN_DESCRIPTIONS} descriptions.`,
    );
  }
  for (const description of descriptions) {
    assertMaxChars(`${adGroupName}: description`, description, GOOGLE_ADS_RSA_DESCRIPTION_MAX);
  }
  if (!ad.finalUrl.trim()) {
    throw new Error(`${adGroupName}: each responsive search ad needs a final URL.`);
  }
  if (ad.path1) assertMaxChars(`${adGroupName}: path1`, ad.path1, GOOGLE_ADS_RSA_PATH_MAX);
  if (ad.path2) assertMaxChars(`${adGroupName}: path2`, ad.path2, GOOGLE_ADS_RSA_PATH_MAX);
}

function assertGoogleAdsReadyCampaignRow(row: PpcCampaignRow): void {
  const name = resolvePpcRowCampaignName(row).trim() || "Campaign";
  if (row.status !== "ready" || !row.campaign) {
    throw new Error(`${name}: generate the campaign before publishing.`);
  }
  const budget = resolvePpcRowDailyBudget(row);
  if (budget === null || budget < GOOGLE_ADS_PUBLISH_MIN_DAILY_BUDGET) {
    throw new Error(`${name}: set a daily budget of at least ${GOOGLE_ADS_PUBLISH_MIN_DAILY_BUDGET} before publishing.`);
  }
  if (row.campaign.network !== "SEARCH") {
    throw new Error(`${name}: only Search campaigns can be published.`);
  }
  const campaignName = resolvePpcRowCampaignName(row).trim() || row.campaign.name.trim();
  if (!campaignName) {
    throw new Error(`${name}: campaign name is required.`);
  }
  assertMaxChars("Campaign name", campaignName, GOOGLE_ADS_CAMPAIGN_NAME_MAX);
  if (!row.campaign.adGroups.length) {
    throw new Error(`${name}: add at least one ad group before publishing.`);
  }
  for (const adGroup of row.campaign.adGroups) {
    const adGroupName = adGroup.name.trim() || "Ad group";
    if (!adGroup.name.trim()) {
      throw new Error(`${name}: every ad group needs a name.`);
    }
    const keywords = trimmedNonEmpty(adGroup.keywords);
    if (!keywords.length) {
      throw new Error(`${adGroupName}: add at least one keyword before publishing.`);
    }
    for (const keyword of keywords) {
      assertMaxChars(`${adGroupName}: keyword`, keyword, GOOGLE_ADS_KEYWORD_MAX);
    }
    if (!adGroup.ads.length) {
      throw new Error(`${adGroupName}: add at least one responsive search ad before publishing.`);
    }
    for (const ad of adGroup.ads) {
      assertPublishableAd(ad, adGroupName);
    }
  }
}

export function assertGoogleAdsPublishableRow(row: PpcCampaignRow): void {
  assertGoogleAdsReadyCampaignRow(row);
  const name = resolvePpcRowCampaignName(row).trim() || "Campaign";
  if (row.adsCampaignId?.trim()) {
    throw new Error(`${name}: already published (${row.adsCampaignId.trim()}).`);
  }
}

export function assertGoogleAdsSyncableRow(row: PpcCampaignRow): void {
  assertGoogleAdsReadyCampaignRow(row);
  const name = resolvePpcRowCampaignName(row).trim() || "Campaign";
  const campaignId = row.adsCampaignId?.trim() ?? "";
  if (!campaignId) {
    throw new Error(`${name}: publish the campaign to Google Ads before syncing updates.`);
  }
  if (!/^\d+$/.test(campaignId)) {
    throw new Error(`${name}: stored Google Ads campaign ID is invalid (${campaignId}).`);
  }
}

function campaignPayloadForGoogleAds(row: PpcCampaignRow): PpcCampaign {
  const name = resolvePpcRowCampaignName(row).trim();
  return {
    ...row.campaign!,
    name: name || row.campaign!.name,
  };
}

export function buildGoogleAdsPublishRequest(
  customerIdRaw: string | undefined,
  row: PpcCampaignRow,
): GoogleAdsPublishCampaignBody {
  const customerId = normalizeGoogleAdsCustomerId(customerIdRaw ?? "");
  if (customerId.length !== 10) {
    throw new Error("Set a 10-digit Google Ads customer ID on this property.");
  }
  assertGoogleAdsPublishableRow(row);
  return {
    customerId,
    dailyBudget: resolvePpcRowDailyBudget(row)!,
    campaign: campaignPayloadForGoogleAds(row),
  };
}

export function buildGoogleAdsSyncRequest(
  customerIdRaw: string | undefined,
  row: PpcCampaignRow,
): GoogleAdsSyncCampaignBody {
  const customerId = normalizeGoogleAdsCustomerId(customerIdRaw ?? "");
  if (customerId.length !== 10) {
    throw new Error("Set a 10-digit Google Ads customer ID on this property.");
  }
  assertGoogleAdsSyncableRow(row);
  return {
    customerId,
    campaignId: row.adsCampaignId!.trim(),
    dailyBudget: resolvePpcRowDailyBudget(row)!,
    campaign: campaignPayloadForGoogleAds(row),
  };
}

export function googleAdsPublishBatchBlockMessage(rows: PpcCampaignRow[]): string {
  const ready = rows.filter((row) => row.status === "ready" && row.campaign);
  const toCreate = collectGoogleAdsPublishRows(rows);
  const toSync = collectGoogleAdsSyncRows(rows);
  if (!toCreate.length && !toSync.length) {
    if (!ready.length) {
      const idle = rows.filter((row) => row.status !== "ready" || !row.campaign);
      if (idle.length === 1) {
        const name = resolvePpcRowCampaignName(idle[0]!).trim() || "Campaign";
        return `${name}: run Generate before publishing (ad groups, keywords, and ads are not built yet).`;
      }
      return `${idle.length} campaigns need Generate before publishing.`;
    }
    return "No generated campaigns to publish or sync.";
  }
  return "No generated campaigns to publish.";
}

export function assertGoogleAdsPublishBatch(
  customerIdRaw: string | undefined,
  rows: PpcCampaignRow[],
): GoogleAdsPublishCampaignBody[] {
  const eligible = collectGoogleAdsPublishRows(rows);
  if (!eligible.length) {
    throw new Error(googleAdsPublishBatchBlockMessage(rows));
  }
  return eligible.map((row) => buildGoogleAdsPublishRequest(customerIdRaw, row));
}

export function assertGoogleAdsSyncBatch(
  customerIdRaw: string | undefined,
  rows: PpcCampaignRow[],
): GoogleAdsSyncCampaignBody[] {
  const eligible = collectGoogleAdsSyncRows(rows);
  if (!eligible.length) {
    throw new Error(googleAdsPublishBatchBlockMessage(rows));
  }
  return eligible.map((row) => buildGoogleAdsSyncRequest(customerIdRaw, row));
}

export function assertGoogleAdsPushBatch(
  customerIdRaw: string | undefined,
  rows: PpcCampaignRow[],
): { create: GoogleAdsPublishCampaignBody[]; sync: GoogleAdsSyncCampaignBody[] } {
  const create = collectGoogleAdsPublishRows(rows);
  const sync = collectGoogleAdsSyncRows(rows);
  if (!create.length && !sync.length) {
    throw new Error(googleAdsPublishBatchBlockMessage(rows));
  }
  return {
    create: create.map((row) => buildGoogleAdsPublishRequest(customerIdRaw, row)),
    sync: sync.map((row) => buildGoogleAdsSyncRequest(customerIdRaw, row)),
  };
}
