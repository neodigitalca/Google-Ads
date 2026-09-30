import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleAdsCampaignInsightsPanel } from "@/components/ppc/google/GoogleAdsCampaignInsightsPanel";
import { GoogleAdsLiveAdsSelect } from "@/components/ppc/google/GoogleAdsLiveAdsSelect";
import {
  GoogleAdsDetailsSection,
  PPC_DETAILS_ACCORDION_STACK,
} from "@/components/ppc/google/google-ads-details-accordion";
import { usePpcCampaignInsights } from "@/hooks/ppc/use-ppc-campaign-insights";
import type { PpcInsightsScope } from "@/lib/ppc/ppc-campaign-insights-scope";
import { PPC_INSIGHTS_SCOPE_CAMPAIGN } from "@/lib/ppc/ppc-campaign-insights-scope";
import type { PpcCampaign } from "@/lib/ppc/google-ads-types";
import type {
  PpcCampaignInsights,
  PpcCampaignStructureAd,
  PpcCampaignStructureAdGroup,
} from "@/lib/ppc/ppc-campaign-insights-types";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const SHELL_CLASS = "min-h-[14rem] w-full min-w-0 rounded-none bg-zinc-950 px-3 py-3";

type GoogleAdsCampaignLiveInsightsSectionProps = {
  customerId: string;
  campaignId: string;
  campaignName: string;
  scope?: PpcInsightsScope;
  campaign?: PpcCampaign;
  selectedLiveAdKey?: string | null;
  onSelectedLiveAdKeyChange?: (key: string | null, ad: PpcCampaignStructureAd | null) => void;
  onStructureAdGroups?: (groups: PpcCampaignStructureAdGroup[]) => void;
  onInsightsReady?: (insights: PpcCampaignInsights) => void;
};

export function GoogleAdsCampaignLiveInsightsSection({
  customerId,
  campaignId,
  campaignName,
  scope = PPC_INSIGHTS_SCOPE_CAMPAIGN,
  campaign,
  selectedLiveAdKey = null,
  onSelectedLiveAdKeyChange,
  onStructureAdGroups,
  onInsightsReady,
}: GoogleAdsCampaignLiveInsightsSectionProps) {
  const { status, insights, errorMessage, refresh, fetchOnceOnOpen } = usePpcCampaignInsights({
    customerId,
    campaignId,
  });

  useEffect(() => {
    if (status === "ready" && insights?.structureAdGroups) {
      onStructureAdGroups?.(insights.structureAdGroups);
    }
  }, [insights?.structureAdGroups, onStructureAdGroups, status]);

  useEffect(() => {
    if (status === "ready" && insights) {
      onInsightsReady?.(insights);
    }
  }, [insights, onInsightsReady, status]);

  const headerAction = (
    <Button
      type="button"
      variant="ghost"
      className="h-8 rounded-none px-2 text-base text-muted-foreground hover:text-white"
      disabled={status === "loading"}
      onClick={(e) => {
        e.stopPropagation();
        void refresh();
      }}
    >
      <RefreshCw className={cn("mr-1 h-4 w-4", status === "loading" && "animate-spin")} aria-hidden />
      Refresh
    </Button>
  );

  return (
    <GoogleAdsDetailsSection
      icon={<span className="text-base font-semibold text-sky-400 tabular-nums">Live</span>}
      title="Google Ads performance"
      badge={campaignName}
      defaultOpen={false}
      headerAction={headerAction}
      onOpenChange={fetchOnceOnOpen}
      contentClassName={PPC_DETAILS_ACCORDION_STACK}
    >
      <div className={SHELL_CLASS}>
        {status === "idle" ? (
          <p className="text-base text-muted-foreground">Open this section to load live metrics from Google Ads.</p>
        ) : null}

        {status === "loading" ? (
          <p className="text-base text-muted-foreground">Loading campaign insights…</p>
        ) : null}

        {status === "error" && errorMessage ? (
          <p className="text-base text-red-400">{errorMessage}</p>
        ) : null}

        {status === "ready" && insights ? (
          <>
            <div className="mb-3 w-full min-w-0">
              <GoogleAdsLiveAdsSelect
                insights={insights}
                campaign={campaign}
                selectedLiveAdKey={selectedLiveAdKey}
                onSelectedLiveAdKeyChange={(key, ad) => onSelectedLiveAdKeyChange?.(key, ad)}
                className="w-full"
              />
            </div>
            <GoogleAdsCampaignInsightsPanel insights={insights} scope={scope} periodHint="Last 30 days" />
          </>
        ) : null}
      </div>
    </GoogleAdsDetailsSection>
  );
}
