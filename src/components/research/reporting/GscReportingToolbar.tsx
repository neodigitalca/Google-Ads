import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import {
  GscReportingComparePopover,
  type GscReportingDateMenuTab,
} from "@/components/research/reporting/GscReportingComparePopover";
export type { GscReportingDateMenuTab };
import { GscReportingRunActions } from "@/components/research/reporting/GscReportingRunActions";
import { GscReportingSupplementUpload } from "@/components/research/reporting/GscReportingSupplementUpload";
import type { ReportingWorkspaceMode } from "@/components/research/reporting/ReportingModePills";
import type {
  GscCompareRanges,
  GscReportStructureUi,
  GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import type { GscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";

export type GscReportingToolbarProps = {
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
  onGenerate: () => void;
  onCancel: () => void;
  canClearReport: boolean;
  onClearReport: () => void;
  reportMode: ReportingWorkspaceMode;
  supplements: GscReportingSupplementFiles;
  onSupplementsChange: (next: GscReportingSupplementFiles) => void;
  dateRangePopoverOpen?: boolean;
  onDateRangePopoverOpenChange?: (open: boolean) => void;
};

export function GscReportingToolbar({
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
  onGenerate,
  onCancel,
  canClearReport,
  onClearReport,
  reportMode,
  supplements,
  onSupplementsChange,
  dateRangePopoverOpen,
  onDateRangePopoverOpenChange,
}: GscReportingToolbarProps) {
  return (
    <GeneratorToolbarFrame
      primary={
        <GscReportingComparePopover
          busy={busy}
          gscReportStructure={gscReportStructure}
          onDateMenuTabChange={onDateMenuTabChange}
          gscFetchPreset={gscFetchPreset}
          onSelectLastMonths={onSelectLastMonths}
          onSelectCustomDates={onSelectCustomDates}
          compareRangeDraft={compareRangeDraft}
          onCompareRangeDraftChange={onCompareRangeDraftChange}
          trailingMonthCount={trailingMonthCount}
          trailingMonthCountDraft={trailingMonthCountDraft}
          onTrailingMonthCountDraftChange={onTrailingMonthCountDraftChange}
          todayYmdMax={todayYmdMax}
          open={dateRangePopoverOpen}
          onOpenChange={onDateRangePopoverOpenChange}
        />
      }
      actions={
        <>
          {reportMode === "seo" || reportMode === "both" ? (
            <GscReportingSupplementUpload
              busy={busy}
              value={supplements}
              onChange={onSupplementsChange}
            />
          ) : null}
          <GscReportingRunActions
            busy={busy}
            canClear={canClearReport}
            onGenerate={onGenerate}
            onCancel={onCancel}
            onClear={onClearReport}
          />
        </>
      }
    />
  );
}
