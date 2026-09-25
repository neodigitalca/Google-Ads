import { ChevronDown, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GoogleAdsCampaignStatusFilterSelect } from "@/components/ppc/google/GoogleAdsCampaignStatusFilterSelect";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  clampPpcAdGroupCount,
  clampPpcAdsPerAdGroup,
  clampPpcCampaignCount,
  PPC_AD_GROUP_COUNT_MAX,
  PPC_AD_GROUP_COUNT_MIN,
  PPC_ADS_PER_GROUP_MAX,
  PPC_ADS_PER_GROUP_MIN,
  PPC_CAMPAIGN_COUNT_MAX,
  PPC_CAMPAIGN_COUNT_MIN,
  type PpcGenerateConfig,
} from "@/lib/ppc/google-ads-types";
import type { PpcGoogleAdsCampaignStatusFilter } from "@/lib/ppc/ppc-google-ads-status-filter";
import type { PpcGoogleWorkspaceController } from "@/hooks/ppc/use-ppc-google-workspace";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<PpcGoogleAdsCampaignStatusFilter, string> = {
  active: "Active",
  paused: "Paused",
  disabled: "Disabled",
  all: "All",
};

const FLYOUT_NUM_INPUT = cn(
  BULK_HEADER_FIELD,
  "h-8 w-12 min-w-12 border-0 bg-zinc-900 px-1 text-center text-base tabular-nums shadow-none focus-visible:ring-2",
);

const FLYOUT_STEP_BTN =
  "h-8 w-8 shrink-0 rounded-none border-0 bg-zinc-900 p-0 text-foreground hover:bg-zinc-800 disabled:opacity-50";

type GoogleAdsCampaignSetupFlyoutProps = {
  ctrl: PpcGoogleWorkspaceController;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
};

function SetupCountRow({
  label,
  inputId,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  inputId: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (next: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  return (
    <div className="flex min-h-8 items-center gap-2">
      <span className="min-w-0 flex-1 text-base text-zinc-200">{label}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={FLYOUT_STEP_BTN}
          disabled={disabled || value <= min}
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={dec}
        >
          <Minus className="h-4 w-4" aria-hidden />
        </Button>
        <input
          id={inputId}
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          aria-label={label}
          className={FLYOUT_NUM_INPUT}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (!Number.isFinite(raw)) return;
            onChange(Math.min(max, Math.max(min, raw)));
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={FLYOUT_STEP_BTN}
          disabled={disabled || value >= max}
          aria-label={`Add ${label.toLowerCase()}`}
          onClick={inc}
        >
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function GoogleAdsCampaignSetupFlyout({
  ctrl,
  disabled = false,
  align = "start",
  className,
}: GoogleAdsCampaignSetupFlyoutProps) {
  const [open, setOpen] = useState(false);
  const {
    generateConfig,
    setGenerateConfig,
    adsCampaignStatusFilter,
    setAdsCampaignStatusFilter,
    displayCampaigns,
  } = ctrl;

  const patchConfig = (patch: Partial<PpcGenerateConfig>) => {
    setGenerateConfig((prev) => ({ ...prev, ...patch }));
  };

  const linkedCount = useMemo(
    () => displayCampaigns.filter((row) => Boolean(row.adsCampaignId?.trim())).length,
    [displayCampaigns],
  );

  const triggerSummary = `${STATUS_LABEL[adsCampaignStatusFilter]} · ${generateConfig.campaignCount} campaigns · ${generateConfig.adGroupCount} ad groups · ${generateConfig.adsPerAdGroup} ads`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          className={cn(
            BULK_HEADER_TOOL_BTN,
            "h-8 min-w-[12rem] max-w-[min(100%,28rem)] shrink-0 justify-between gap-2 px-2.5 tabular-nums",
            className,
          )}
          aria-label="Campaign setup and filters"
        >
          <span className="min-w-0 truncate text-left">{triggerSummary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[min(100vw-2rem,22rem)] rounded-none border-0 bg-zinc-950 p-0 text-base shadow-lg"
      >
        <div className="flex flex-col gap-3 px-3 py-3">
          <p className="text-base font-medium text-white">Campaign setup</p>

          <div className="flex min-h-8 items-center gap-2">
            <span className="flex-1 text-base text-zinc-200">Status filter</span>
            <GoogleAdsCampaignStatusFilterSelect
              id="ppc-setup-status-filter"
              value={adsCampaignStatusFilter}
              disabled={disabled}
              className="min-w-[7rem] bg-zinc-900"
              onChange={setAdsCampaignStatusFilter}
            />
          </div>

          <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />

          <SetupCountRow
            label="Campaign rows"
            inputId="ppc-setup-campaign-count"
            value={generateConfig.campaignCount}
            min={PPC_CAMPAIGN_COUNT_MIN}
            max={PPC_CAMPAIGN_COUNT_MAX}
            disabled={disabled}
            onChange={(next) => patchConfig({ campaignCount: clampPpcCampaignCount(next) })}
          />
          <SetupCountRow
            label="Ad groups each"
            inputId="ppc-setup-ad-group-count"
            value={generateConfig.adGroupCount}
            min={PPC_AD_GROUP_COUNT_MIN}
            max={PPC_AD_GROUP_COUNT_MAX}
            disabled={disabled}
            onChange={(next) => patchConfig({ adGroupCount: clampPpcAdGroupCount(next) })}
          />
          <SetupCountRow
            label="Ads per group"
            inputId="ppc-setup-ads-count"
            value={generateConfig.adsPerAdGroup}
            min={PPC_ADS_PER_GROUP_MIN}
            max={PPC_ADS_PER_GROUP_MAX}
            disabled={disabled}
            onChange={(next) => patchConfig({ adsPerAdGroup: clampPpcAdsPerAdGroup(next) })}
          />

          <p className="text-base tabular-nums text-muted-foreground">
            {linkedCount} linked campaign{linkedCount === 1 ? "" : "s"} in this view
          </p>

          <Button
            type="button"
            variant="ghost"
            disabled={disabled || generateConfig.campaignCount >= PPC_CAMPAIGN_COUNT_MAX}
            className="h-8 w-full justify-start rounded-none bg-zinc-900 px-2 text-base text-foreground hover:bg-zinc-800"
            onClick={() =>
              patchConfig({
                campaignCount: clampPpcCampaignCount(generateConfig.campaignCount + 1),
              })
            }
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            Add new campaign row
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
