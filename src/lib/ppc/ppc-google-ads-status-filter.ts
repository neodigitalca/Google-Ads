import type { PpcCampaignRow } from "@/lib/ppc/google-ads-types";

export type PpcGoogleAdsCampaignStatusFilter = "all" | "active" | "paused" | "disabled";

export const PPC_GOOGLE_ADS_STATUS_FILTER_DEFAULT: PpcGoogleAdsCampaignStatusFilter = "active";

export function ppcGoogleAdsCampaignStatusBucket(
  status: string | undefined,
): "active" | "paused" | "disabled" | "none" {
  const key = (status ?? "").trim().toUpperCase();
  if (key === "ENABLED") return "active";
  if (key === "PAUSED") return "paused";
  if (key === "REMOVED") return "disabled";
  return "none";
}

export function ppcRowMatchesGoogleAdsStatusFilter(
  row: PpcCampaignRow,
  filter: PpcGoogleAdsCampaignStatusFilter,
): boolean {
  if (filter === "all") return true;
  const bucket = ppcGoogleAdsCampaignStatusBucket(row.googleAdsCampaignStatus);
  if (filter === "active") return bucket === "active";
  if (filter === "paused") return bucket === "paused";
  if (filter === "disabled") return bucket === "disabled";
  return true;
}
