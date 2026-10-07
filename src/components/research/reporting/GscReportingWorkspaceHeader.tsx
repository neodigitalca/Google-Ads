import { useMemo } from "react";
import { BlogGeneratorWorkspaceChrome } from "@/components/blog-generator/BlogGeneratorWorkspaceChrome";
import type { ReactNode } from "react";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import { BulkGeneratorDetailsDrawer } from "@/components/keyword-research/bulk/BulkGeneratorDetailsDrawer";
import {
  GscReportingDetailsPanel,
  type GscReportingDetailsPanelProps,
} from "@/components/research/reporting/GscReportingDetailsPanel";
import { GscReportingToolbar, type GscReportingToolbarProps } from "@/components/research/reporting/GscReportingToolbar";
import { buildGscReportingBulkGeneratorDetailsProps } from "@/lib/gsc-reporting/gsc-reporting-bulk-details-bindings";
import { buildGscReportingMicroSnapshot } from "@/lib/gsc-reporting/gsc-reporting-header-progress";
import type { ReportingWorkspaceMode } from "@/components/research/reporting/ReportingModePills";
import type { ReportingLane } from "@/lib/reporting/reporting-lane-artifacts";
import type { GscReportingPipelineProgress } from "@/lib/gsc-reporting/gsc-reporting-types";
import type { GscReportingSectionPlan, GscReportingSectionResult } from "@/lib/gsc-reporting/gsc-reporting-types";

const DETAILS_PANEL_ID = "gsc-reporting-details-panel";

export type GscReportingWorkspaceHeaderProps = GeneratorWorkspaceChromeBindings & {
  busy: boolean;
  progress: GscReportingPipelineProgress | null;
  toolbarProps: GscReportingToolbarProps;
  detailsProps: GscReportingDetailsPanelProps;
  canOpenDetails: boolean;
  outlineSections?: GscReportingSectionPlan[];
  sectionMap?: Record<number, GscReportingSectionResult>;
  generatingSectionIndex?: number | null;
  titleRowMenu?: ReactNode;
  reportRunPinned?: boolean;
  reportMode?: ReportingWorkspaceMode;
  progressLeg?: ReportingLane | null;
};

export function GscReportingWorkspaceHeader({
  activeSection,
  onSectionChange,
  onDetailsOpenChange,
  busy,
  progress,
  toolbarProps,
  detailsProps,
  canOpenDetails,
  outlineSections,
  sectionMap,
  generatingSectionIndex,
  titleRowMenu,
  reportRunPinned = false,
  reportMode = "seo",
  progressLeg = null,
}: GscReportingWorkspaceHeaderProps) {
  const showProgressChrome = busy || (reportRunPinned && Boolean(progress?.label?.trim()));
  const progressSnapshot = useMemo(
    () =>
      showProgressChrome
        ? buildGscReportingMicroSnapshot(progress, reportMode, progressLeg ?? undefined)
        : null,
    [showProgressChrome, progress, reportMode, progressLeg],
  );

  const drawerProps = useMemo(
    () =>
      buildGscReportingBulkGeneratorDetailsProps({
        ...detailsProps,
        outlineSections,
        sectionMap,
        generatingSectionIndex,
      }),
    [detailsProps, outlineSections, sectionMap, generatingSectionIndex],
  );

  return (
    <BlogGeneratorWorkspaceChrome
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      titleRowMenu={titleRowMenu}
      sectionSwitchDisabled={busy}
      workspaceBusy={busy}
      progressSnapshot={progressSnapshot}
      canOpenDetails={canOpenDetails}
      isProcessing={showProgressChrome}
      detailsPanelId={DETAILS_PANEL_ID}
      onDetailsOpenChange={onDetailsOpenChange}
      toolbar={<GscReportingToolbar {...toolbarProps} />}
      detailsPanel={
        <>
          <GscReportingDetailsPanel {...detailsProps} />
          <BulkGeneratorDetailsDrawer
            variant="csv"
            postDestination="local"
            wpConfig={null}
            {...drawerProps}
          />
        </>
      }
    />
  );
}
