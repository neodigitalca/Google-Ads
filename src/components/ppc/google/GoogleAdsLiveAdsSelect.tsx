import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BULK_HEADER_SELECT_TRIGGER } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { PpcCampaign } from "@/lib/ppc/google-ads-types";
import { ppcAdDailySeriesKey } from "@/lib/ppc/ppc-campaign-insights-scope";
import type { PpcCampaignInsights, PpcCampaignStructureAd } from "@/lib/ppc/ppc-campaign-insights-types";
import { cn } from "@/lib/utils";

const NONE_VALUE = "__none__";

export type GoogleAdsLiveAdsSelectProps = {
  insights: PpcCampaignInsights | null;
  campaign: PpcCampaign | undefined;
  selectedLiveAdKey: string | null;
  onSelectedLiveAdKeyChange: (key: string | null, ad: PpcCampaignStructureAd | null) => void;
  className?: string;
};

function fallbackAdsFromCampaign(campaign: PpcCampaign | undefined): PpcCampaignStructureAd[] {
  if (!campaign) return [];
  const out: PpcCampaignStructureAd[] = [];
  for (const ag of campaign.adGroups) {
    ag.ads.forEach((ad, adIndex) => {
      const adId = ad.id?.trim() || `local-${ag.id}-${adIndex}`;
      out.push({
        adGroupId: ag.id,
        adGroupName: ag.name,
        adId,
        status: "",
        label: `${ag.name} · Responsive search ad ${adIndex + 1}`,
      });
    });
  }
  return out;
}

export function listPpcLiveAdsOptions(
  insights: PpcCampaignInsights | null,
  campaign: PpcCampaign | undefined,
): PpcCampaignStructureAd[] {
  if (insights?.structureAds.length) return insights.structureAds;
  return fallbackAdsFromCampaign(campaign);
}

export function GoogleAdsLiveAdsSelect({
  insights,
  campaign,
  selectedLiveAdKey,
  onSelectedLiveAdKeyChange,
  className,
}: GoogleAdsLiveAdsSelectProps) {
  const options = listPpcLiveAdsOptions(insights, campaign);
  if (options.length === 0) return null;

  return (
    <Select
      value={selectedLiveAdKey ?? NONE_VALUE}
      onValueChange={(value) => {
        if (value === NONE_VALUE) {
          onSelectedLiveAdKeyChange(null, null);
          return;
        }
        const ad = options.find((row) => ppcAdDailySeriesKey(row.adGroupId, row.adId) === value) ?? null;
        onSelectedLiveAdKeyChange(value, ad);
      }}
    >
      <SelectTrigger className={cn(BULK_HEADER_SELECT_TRIGGER, "w-full min-w-0 sm:min-w-[16rem]", className)}>
        <SelectValue placeholder="Google Ads in this campaign" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>All ads (level from focus)</SelectItem>
        {options.map((row) => {
          const key = ppcAdDailySeriesKey(row.adGroupId, row.adId);
          return (
            <SelectItem key={key} value={key}>
              {row.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
