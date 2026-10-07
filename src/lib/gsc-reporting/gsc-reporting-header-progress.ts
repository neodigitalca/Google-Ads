import type { ReportingWorkspaceMode } from "@/components/research/reporting/ReportingModePills";
import type { MetaBulkMicroSnapshot } from "@/components/overview/OverviewBulkMicroProgress";
import type { ReportingLane } from "@/lib/reporting/reporting-lane-artifacts";
import type { GscReportingPipelineProgress } from "@/lib/gsc-reporting/gsc-reporting-types";

export const GSC_REPORT_LABEL = "GSC report";
export const PPC_REPORT_LABEL = "PPC report";
export const SEO_REPORT_LABEL = "SEO report";

export type ReportingMicroSnapshotKind = "seo" | "ppc";

export function buildGscReportingMicroSnapshot(
  progress: GscReportingPipelineProgress | null | undefined,
  mode: ReportingWorkspaceMode = "seo",
  leg?: ReportingLane,
): MetaBulkMicroSnapshot | null {
  if (!progress?.label?.trim()) return null;

  const label =
    mode === "both"
      ? leg === "ppc"
        ? PPC_REPORT_LABEL
        : SEO_REPORT_LABEL
      : mode === "ppc"
        ? PPC_REPORT_LABEL
        : GSC_REPORT_LABEL;
  const phase = progress.label.trim();
  const completed = Math.max(0, Math.floor(progress.step));
  const total = Math.max(1, Math.floor(progress.total));
  const statusMessage =
    phase.toLowerCase() !== label.toLowerCase() ? phase : undefined;
  const progressPct =
    progress.total > 0
      ? Math.min(100, Math.max(0, Math.round((progress.step / progress.total) * 100)))
      : undefined;

  return { label, completed, total, statusMessage, progressPct };
}

export function gscReportingProgressBusy(
  progress: GscReportingPipelineProgress | null | undefined,
): boolean {
  return Boolean(progress?.label?.trim());
}
