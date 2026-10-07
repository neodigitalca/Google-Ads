import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BULK_HEADER_SELECT } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  formatGscReportingDateMenuTriggerLabel,
  formatGscReportingLastMonthsLabel,
  GSC_REPORTING_LAST_MONTH_PRESETS,
  isGscReportingPresetMonthCount,
  parseTrailingMonthCount,
  type GscCompareRanges,
  type GscReportStructureUi,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import { cn } from "@/lib/utils";

export type GscReportingDateMenuTab = "filter" | "compare";

export type GscReportingComparePopoverProps = {
  busy: boolean;
  gscReportStructure: GscReportStructureUi;
  onDateMenuTabChange: (tab: GscReportingDateMenuTab) => void;
  gscFetchPreset: GscReportingComparePresetId;
  onSelectLastMonths: (monthCount: number, dateMenuTab: GscReportingDateMenuTab) => void;
  onSelectCustomDates: () => void;
  compareRangeDraft: GscCompareRanges;
  onCompareRangeDraftChange: (updater: (prev: GscCompareRanges) => GscCompareRanges) => void;
  trailingMonthCount: number | null;
  trailingMonthCountDraft: string;
  onTrailingMonthCountDraftChange: (value: string) => void;
  todayYmdMax: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function DateMenuTab({
  active,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex-1 border-b-2 pb-2 text-base transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function MonthRadioRow({
  checked,
  disabled,
  onSelect,
  children,
}: {
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-none px-1 py-2 text-left text-base transition-colors",
        checked ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
      onClick={onSelect}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-primary" : "border-muted-foreground",
        )}
        aria-hidden
      >
        {checked ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export function GscReportingComparePopover({
  busy,
  gscReportStructure,
  onDateMenuTabChange,
  gscFetchPreset,
  onSelectLastMonths,
  onSelectCustomDates,
  compareRangeDraft,
  onCompareRangeDraftChange,
  trailingMonthCount,
  trailingMonthCountDraft,
  onTrailingMonthCountDraftChange,
  todayYmdMax,
  open,
  onOpenChange,
}: GscReportingComparePopoverProps) {
  const periodProgress = gscReportStructure === "period_progress";
  const activeTab: GscReportingDateMenuTab = periodProgress ? "filter" : "compare";
  const customDatesActive = gscFetchPreset === "custom_compare";
  const effectiveMonths = trailingMonthCount ?? 1;
  const customMonthRowActive =
    !customDatesActive && !isGscReportingPresetMonthCount(effectiveMonths);

  const triggerLabel = formatGscReportingDateMenuTriggerLabel(
    gscReportStructure,
    trailingMonthCount,
    gscFetchPreset,
    compareRangeDraft.primary,
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          id="gsc-fetch-preset"
          disabled={busy}
          aria-label="Date range"
          className={cn(
            BULK_HEADER_SELECT,
            "h-8 w-[11rem] shrink-0 justify-between gap-1 px-2 font-normal hover:bg-zinc-700",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(calc(100vw-2rem),17rem)] space-y-3 border border-white/10 bg-zinc-900 p-3 shadow-lg"
      >
        <div className="flex gap-2" role="tablist" aria-label="Date range mode">
          <DateMenuTab
            active={activeTab === "filter"}
            label="Filter"
            disabled={busy}
            onClick={() => onDateMenuTabChange("filter")}
          />
          <DateMenuTab
            active={activeTab === "compare"}
            label="Compare"
            disabled={busy}
            onClick={() => onDateMenuTabChange("compare")}
          />
        </div>

        <div className="space-y-0.5" role="radiogroup" aria-label="Last months">
          {GSC_REPORTING_LAST_MONTH_PRESETS.map((n) => (
            <MonthRadioRow
              key={n}
              checked={!customDatesActive && effectiveMonths === n}
              disabled={busy}
              onSelect={() => {
                const tab: GscReportingDateMenuTab = periodProgress ? "filter" : "compare";
                onDateMenuTabChange(tab);
                onSelectLastMonths(n, tab);
              }}
            >
              {formatGscReportingLastMonthsLabel(n)}
            </MonthRadioRow>
          ))}

          <MonthRadioRow
            checked={customMonthRowActive}
            disabled={busy}
            onSelect={() => {
              const tab: GscReportingDateMenuTab = periodProgress ? "filter" : "compare";
              onDateMenuTabChange(tab);
              const parsed = parseTrailingMonthCount(trailingMonthCountDraft);
              onSelectLastMonths(parsed ?? effectiveMonths, tab);
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="shrink-0">Last</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={36}
                step={1}
                aria-label="Month count"
                disabled={busy}
                value={trailingMonthCountDraft}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const next = e.target.value;
                  onTrailingMonthCountDraftChange(next);
                  const parsed = parseTrailingMonthCount(next);
                  if (parsed != null) {
                    const tab: GscReportingDateMenuTab = periodProgress ? "filter" : "compare";
                    onDateMenuTabChange(tab);
                    onSelectLastMonths(parsed, tab);
                  }
                }}
                className={cn(BULK_HEADER_SELECT, "h-8 w-[4rem] shrink-0 px-2 tabular-nums")}
              />
              <span className="min-w-0 truncate">months</span>
            </span>
          </MonthRadioRow>

          <MonthRadioRow checked={customDatesActive} disabled={busy} onSelect={onSelectCustomDates}>
            Custom
          </MonthRadioRow>
        </div>

        {customDatesActive ? (
          <div className="space-y-3 border-t border-white/10 pt-3">
            <DateRangeRow
              range={compareRangeDraft.primary}
              todayYmdMax={todayYmdMax}
              disabled={busy}
              startAria={periodProgress ? "Start date" : "Period A start"}
              endAria={periodProgress ? "End date" : "Period A end"}
              onChange={(patch) => {
                onCompareRangeDraftChange((r) => ({
                  ...r,
                  primary: { ...r.primary, ...patch },
                }));
              }}
            />
            {!periodProgress ? (
              <DateRangeRow
                range={compareRangeDraft.compare}
                todayYmdMax={todayYmdMax}
                disabled={busy}
                startAria="Period B start"
                endAria="Period B end"
                onChange={(patch) => {
                  onCompareRangeDraftChange((r) => ({
                    ...r,
                    compare: { ...r.compare, ...patch },
                  }));
                }}
              />
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function DateRangeRow({
  range,
  todayYmdMax,
  disabled,
  startAria,
  endAria,
  onChange,
}: {
  range: { startDate: string; endDate: string };
  todayYmdMax: string;
  disabled: boolean;
  startAria: string;
  endAria: string;
  onChange: (patch: Partial<{ startDate: string; endDate: string }>) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <Input
        type="date"
        aria-label={startAria}
        placeholder="Start date"
        className={cn(BULK_HEADER_SELECT, "h-8 w-full px-2 font-sans")}
        max={todayYmdMax}
        disabled={disabled}
        value={range.startDate}
        onChange={(e) => onChange({ startDate: e.target.value })}
      />
      <span className="text-muted-foreground" aria-hidden>
        -
      </span>
      <Input
        type="date"
        aria-label={endAria}
        placeholder="End date"
        className={cn(BULK_HEADER_SELECT, "h-8 w-full px-2 font-sans")}
        max={todayYmdMax}
        disabled={disabled}
        value={range.endDate}
        onChange={(e) => onChange({ endDate: e.target.value })}
      />
    </div>
  );
}
