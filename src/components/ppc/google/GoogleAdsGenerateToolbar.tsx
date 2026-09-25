import { Download, ExternalLink, RefreshCw, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoogleAdsCampaignSetupFlyout } from "@/components/ppc/google/GoogleAdsCampaignSetupFlyout";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { useGoogleAdsConnectionStatus } from "@/hooks/use-google-ads-connection-status";
import {
  formatGoogleAdsCustomerId,
  googleAdsAccountUrl,
  normalizeGoogleAdsCustomerId,
} from "@/lib/ads-reporting/ads-reporting-metrics";
import type { PpcGoogleWorkspaceController } from "@/hooks/ppc/use-ppc-google-workspace";
import { cn } from "@/lib/utils";

export type GoogleAdsGenerateToolbarProps = {
  ctrl: PpcGoogleWorkspaceController;
  disabled?: boolean;
};

export function GoogleAdsGenerateToolbar({ ctrl, disabled = false }: GoogleAdsGenerateToolbarProps) {
  const {
    handleGenerateCampaign,
    handleExportGoogleAdsCsv,
    canExportGoogleAdsCsv,
    handlePublishCampaigns,
    canPublish,
    handlePullFromGoogleAds,
    canPullFromGoogleAds,
    isImportingFromAds,
    isGenerating,
    isPublishing,
  } = ctrl;
  const toolbarDisabled = disabled || isGenerating || isPublishing || isImportingFromAds;
  const { mccId } = useGoogleAdsConnectionStatus();
  const adsCustomerId = normalizeGoogleAdsCustomerId(ctrl.site.googleAdsCustomerId ?? "");
  const adsAccountHref = googleAdsAccountUrl(adsCustomerId, mccId);
  const adsAccountLabel =
    adsCustomerId.length === 10 ? formatGoogleAdsCustomerId(adsCustomerId) : "Ads account";

  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto">
      <GoogleAdsCampaignSetupFlyout ctrl={ctrl} disabled={toolbarDisabled} />

      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5">
        <a
          className={cn(
            BULK_HEADER_TOOL_BTN,
            "inline-flex min-w-[8.5rem] items-center gap-1.5 tabular-nums no-underline",
            !adsAccountHref && "pointer-events-none opacity-50",
          )}
          href={adsAccountHref ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={
            adsAccountHref
              ? `Open Google Ads account ${adsAccountLabel}`
              : "Google Ads customer ID is not set on this property"
          }
          aria-disabled={!adsAccountHref}
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          {adsAccountLabel}
        </a>

        <Button
          type="button"
          variant="ghost"
          disabled={toolbarDisabled || !canPullFromGoogleAds}
          className={cn(BULK_HEADER_TOOL_BTN, "shrink-0 gap-1.5")}
          onClick={() => void handlePullFromGoogleAds()}
        >
          <RefreshCw className={cn("h-4 w-4", isImportingFromAds && "animate-spin")} aria-hidden />
          Pull
        </Button>

        <Button
          type="button"
          disabled={toolbarDisabled}
          className={cn(BULK_HEADER_RUN_BTN, "shrink-0 gap-1.5")}
          onClick={() => void handleGenerateCampaign()}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Generate
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={toolbarDisabled || !canPublish}
          className={cn(BULK_HEADER_TOOL_BTN, "shrink-0 gap-1.5")}
          onClick={() => void handlePublishCampaigns()}
        >
          <Upload className="h-4 w-4" aria-hidden />
          Publish
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={toolbarDisabled || !canExportGoogleAdsCsv}
          className={cn(BULK_HEADER_TOOL_BTN, "shrink-0 gap-1.5")}
          onClick={handleExportGoogleAdsCsv}
        >
          <Download className="h-4 w-4" aria-hidden />
          CSV
        </Button>
      </div>
    </div>
  );
}
