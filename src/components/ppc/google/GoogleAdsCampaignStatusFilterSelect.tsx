import { BULK_HEADER_SELECT } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { PpcGoogleAdsCampaignStatusFilter } from "@/lib/ppc/ppc-google-ads-status-filter";
import { cn } from "@/lib/utils";

export type GoogleAdsCampaignStatusFilterSelectProps = {
  value: PpcGoogleAdsCampaignStatusFilter;
  onChange: (value: PpcGoogleAdsCampaignStatusFilter) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function GoogleAdsCampaignStatusFilterSelect({
  value,
  onChange,
  disabled = false,
  id = "ppc-campaign-status-filter",
  className,
}: GoogleAdsCampaignStatusFilterSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      aria-label="Campaign status"
      className={cn(
        BULK_HEADER_SELECT,
        "h-8 min-w-[6.5rem] shrink-0 border-0 bg-zinc-900 px-2 text-base text-foreground shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [color-scheme:dark]",
        className,
      )}
      onChange={(e) => onChange(e.target.value as PpcGoogleAdsCampaignStatusFilter)}
    >
      <option value="active">Active</option>
      <option value="paused">Paused</option>
      <option value="disabled">Disabled</option>
      <option value="all">All</option>
    </select>
  );
}
