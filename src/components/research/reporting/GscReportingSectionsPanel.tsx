import {
  GscReportingWorkspaceBody,
  type GscReportingWorkspaceBodyProps,
} from "@/components/research/reporting/GscReportingWorkspaceBody";

export type GscReportingSectionsPanelProps = GscReportingWorkspaceBodyProps;

export function GscReportingSectionsPanel(props: GscReportingSectionsPanelProps) {
  return <GscReportingWorkspaceBody {...props} />;
}
