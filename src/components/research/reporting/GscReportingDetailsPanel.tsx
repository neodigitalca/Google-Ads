import type { GscFetchDateRange } from "@/lib/gsc-reporting/gsc-console-ui-url";
import {
  GSC_REPORTING_COMPARE_PRESET_OPTIONS,
  GSC_REPORT_STRUCTURE_OPTIONS,
  type GscReportStructureUi,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import type { GscReportingPipelineProgress } from "@/lib/gsc-reporting/gsc-reporting-types";
import type { GscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import { gscReportingSupplementsHasContent } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import { GscReportingSupplementDetailsSection } from "@/components/research/reporting/GscReportingSupplementDetailsSection";
import type { ReportingWorkspaceMode } from "@/components/research/reporting/ReportingModePills";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type GscReportingDetailsPanelProps = {
  busy: boolean;
  progress: GscReportingPipelineProgress | null;
  siteName: string | null;
  siteUrl: string | null;
  gscFetchPreset: GscReportingComparePresetId;
  gscReportStructure?: GscReportStructureUi;
  gscFetchRange: GscFetchDateRange | null;
  gscCompareFetchRange: GscFetchDateRange | null;
  cachedFileCount: number;
  sectionCount: number;
  supplements?: GscReportingSupplementFiles;
  onSupplementsChange?: (next: GscReportingSupplementFiles) => void;
  reportMode?: ReportingWorkspaceMode;
};

export function gscReportingDetailsCanOpen(
  hasSite: boolean,
  busy: boolean,
  hasReport: boolean,
  cachedFileCount: number,
  supplements?: GscReportingSupplementFiles,
): boolean {
  return (
    workspaceDetailsCanOpen(hasSite, busy, hasReport, cachedFileCount > 0) ||
    gscReportingSupplementsHasContent(supplements)
  );
}

export function GscReportingDetailsPanel({
  busy,
  progress,
  siteName,
  siteUrl,
  gscFetchPreset,
  gscReportStructure = "compare",
  gscFetchRange,
  gscCompareFetchRange,
  cachedFileCount,
  sectionCount,
  supplements,
  onSupplementsChange,
  reportMode = "seo",
}: GscReportingDetailsPanelProps) {
  const presetLabel =
    GSC_REPORTING_COMPARE_PRESET_OPTIONS.find((o) => o.id === gscFetchPreset)?.label ?? gscFetchPreset;
  const isPpc = reportMode === "ppc";
  const isFilter = gscReportStructure === "period_progress";

  let kvIndex = 0;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        {siteName ? (
          <WorkspaceDetailsKvRow label="Site" value={siteName} stripeIndex={kvIndex++} />
        ) : null}
        {siteUrl ? (
          <WorkspaceDetailsKvRow label="Property URL" value={siteUrl} stripeIndex={kvIndex++} />
        ) : null}
        <WorkspaceDetailsKvRow
          label="Report structure"
          value={
            GSC_REPORT_STRUCTURE_OPTIONS.find((o) => o.id === gscReportStructure)?.label ??
            gscReportStructure
          }
          stripeIndex={kvIndex++}
        />
        <WorkspaceDetailsKvRow label="Compare preset" value={presetLabel} stripeIndex={kvIndex++} />
        {gscFetchRange ? (
          <WorkspaceDetailsKvRow
            label={isPpc ? "Ads date range" : "Fetched period A"}
            value={`${gscFetchRange.startDate} → ${gscFetchRange.endDate}`}
            stripeIndex={kvIndex++}
          />
        ) : null}
        {gscCompareFetchRange && !(isPpc && isFilter) ? (
          <WorkspaceDetailsKvRow
            label="Fetched period B"
            value={`${gscCompareFetchRange.startDate} → ${gscCompareFetchRange.endDate}`}
            stripeIndex={kvIndex++}
          />
        ) : null}
        {cachedFileCount > 0 ? (
          <WorkspaceDetailsKvRow
            label={isPpc ? "Cached Ads CSV files" : "Cached GSC files"}
            value={String(cachedFileCount)}
            stripeIndex={kvIndex++}
          />
        ) : null}
        {sectionCount > 0 ? (
          <WorkspaceDetailsKvRow label="Report sections" value={String(sectionCount)} stripeIndex={kvIndex++} />
        ) : null}
      </WorkspaceDetailsSection>

      {supplements && onSupplementsChange ? (
        <GscReportingSupplementDetailsSection
          busy={busy}
          supplements={supplements}
          onSupplementsChange={onSupplementsChange}
          stripeIndex={1}
        />
      ) : null}

      {busy && progress ? (
        <WorkspaceDetailsSection title="Run detail" stripeIndex={2} defaultOpen>
          <WorkspaceDetailsKvRow label="Phase" value={progress.label} stripeIndex={0} />
          <WorkspaceDetailsKvRow
            label="Step"
            value={`${progress.step} of ${progress.total}`}
            stripeIndex={1}
          />
        </WorkspaceDetailsSection>
      ) : null}
    </WorkspaceDetailsStack>
  );
}
