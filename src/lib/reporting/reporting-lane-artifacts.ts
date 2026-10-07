import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import type { ReportingWorkspaceMode } from "@/components/research/reporting/ReportingModePills";
import type { GscFetchDateRange } from "@/lib/gsc-reporting/gsc-console-ui-url";

export type ReportingLane = "seo" | "ppc";

export type ReportingLaneArtifacts = {
  reportMd: string | null;
  files: { name: string; content: string }[];
  pinned: boolean;
  fetchRange: GscFetchDateRange | null;
  compareFetchRange: GscFetchDateRange | null;
};

export function emptyReportingLaneArtifacts(): ReportingLaneArtifacts {
  return {
    reportMd: null,
    files: [],
    pinned: false,
    fetchRange: null,
    compareFetchRange: null,
  };
}

export function emptyReportingLanesState(): Record<ReportingLane, ReportingLaneArtifacts> {
  return {
    seo: emptyReportingLaneArtifacts(),
    ppc: emptyReportingLaneArtifacts(),
  };
}

/** Fixed report row slots at top of workspace body (zero CLS). */
export function reportingLaneCountForMode(mode: ReportingWorkspaceMode): number {
  return mode === "both" ? 2 : 1;
}

/** Placeholders fill the stack when no report rows are shown (idle workspace). */
export function reportingPlaceholderRowCountForVisibleReportRows(visibleReportRowCount: number): number {
  return Math.max(0, BULK_GENERATOR_EMPTY_ROW_COUNT - visibleReportRowCount);
}

export type LaneReportRowMountOptions = {
  mode: ReportingWorkspaceMode;
  /** Whole generate still in flight (Both: hide partial SEO row until PPC leg finishes). */
  runBusy: boolean;
};

export function laneReportRowShouldMount(
  row: { hasReport: boolean },
  opts?: LaneReportRowMountOptions,
): boolean {
  if (!row.hasReport) return false;
  if (opts?.mode === "both" && opts.runBusy) return false;
  return true;
}

/** Which export row is active for single-lane modes. */
export function primaryReportingLaneForMode(mode: ReportingWorkspaceMode): ReportingLane {
  return mode === "ppc" ? "ppc" : "seo";
}

export function lanesForWorkspaceMode(mode: ReportingWorkspaceMode): ReportingLane[] {
  if (mode === "both") return ["seo", "ppc"];
  return [primaryReportingLaneForMode(mode)];
}
