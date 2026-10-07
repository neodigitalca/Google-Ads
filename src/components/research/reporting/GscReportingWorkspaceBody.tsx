import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { GscReportingPlaceholderRows } from "@/components/research/reporting/GscReportingPlaceholderRows";
import { GscReportingReportRow } from "@/components/research/reporting/GscReportingReportRow";
import type { ReportingWorkspaceMode } from "@/components/research/reporting/ReportingModePills";
import type { ReportingLane } from "@/lib/reporting/reporting-lane-artifacts";
import {
  laneReportRowShouldMount,
  lanesForWorkspaceMode,
  reportingPlaceholderRowCountForVisibleReportRows,
} from "@/lib/reporting/reporting-lane-artifacts";
import { cn } from "@/lib/utils";

export type GscReportingReportRowModel = {
  lane: ReportingLane;
  title: string;
  busy: boolean;
  hasReport: boolean;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onExportKb: () => void;
  onOpenGoogleDrive: () => void;
};

export type GscReportingWorkspaceBodyProps = {
  reportMode: ReportingWorkspaceMode;
  runBusy: boolean;
  rowsByLane: Record<ReportingLane, GscReportingReportRowModel>;
};

/** Report export rows mount only while generating or after a report exists; otherwise all stripes are blank placeholders. */
export function GscReportingWorkspaceBody({ reportMode, runBusy, rowsByLane }: GscReportingWorkspaceBodyProps) {
  const lanes = lanesForWorkspaceMode(reportMode);
  const mountOpts = { mode: reportMode, runBusy };
  const visibleLanes = lanes.filter((lane) => laneReportRowShouldMount(rowsByLane[lane], mountOpts));
  const placeholderStart = visibleLanes.length;
  const placeholderCount = reportingPlaceholderRowCountForVisibleReportRows(visibleLanes.length);

  return (
    <div
      className={cn(
        CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
      aria-label="Report rows"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {visibleLanes.map((lane, index) => {
          const row = rowsByLane[lane];
          return (
            <GscReportingReportRow
              key={lane}
              stripeIndex={index}
              laneLabel={reportMode === "both" ? (lane === "seo" ? "SEO" : "PPC") : undefined}
              title={row.title}
              busy={row.busy}
              hasReport={row.hasReport}
              onCopyMarkdown={row.onCopyMarkdown}
              onDownloadMarkdown={row.onDownloadMarkdown}
              onExportKb={row.onExportKb}
              onOpenGoogleDrive={row.onOpenGoogleDrive}
            />
          );
        })}
        <GscReportingPlaceholderRows startStripeIndex={placeholderStart} count={placeholderCount} />
      </div>
    </div>
  );
}
