import { saveWorkflowStepOutput } from "@/lib/workflow/workflow-api";
import { resolveArchiveOutputForClient } from "@/lib/workflow/workflow-rag-utils";
import { resolveWorkflowSiteContext } from "@/lib/workflow/workflow-walk-helpers";
import {
  filterWorkflowArchiveFileRefs,
  mergeWorkflowDeliverableFileRefs,
} from "@/lib/workflow/workflow-rag-archive";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import { clientDeliverableOutputs } from "@/lib/workflow/workflow-rag-client";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRagArchiveConfig,
  WorkflowRun,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";
import type { WorkflowWalkClientScope } from "@/lib/workflow/workflow-client-context";
import { resolveWorkflowSiteId } from "@/lib/workflow/workflow-dispatch-agent-core";
import type { WalkFromNodeResult } from "@/lib/workflow/workflow-walk-types";

export async function walkWorkflowRagArchiveNode(args: {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  node: WorkflowNode;
  outputs: WorkflowStepOutput[];
  walkScope: WorkflowWalkClientScope;
  allSiteIds: string[];
}): Promise<WalkFromNodeResult | null> {
  const { workflow, run, node, outputs, walkScope, allSiteIds } = args;
  if (node.kind !== "rag_archive") return null;

  const config = node.config as WorkflowRagArchiveConfig;
  if (!config.variableKey) {
    return { ok: true };
  }
  const deliverableScope = config.deliverableScope ?? "final";
  const sitesForArchive =
    walkScope.activeSiteIds.length > 0
      ? walkScope.activeSiteIds
      : ([resolveWorkflowSiteId(workflow)].filter(Boolean) as string[]);

  for (const siteId of sitesForArchive) {
    const siteContext = resolveWorkflowSiteContext(siteId);
    const deliverableOutputs = clientDeliverableOutputs(
      outputs,
      workflow.nodes,
      siteId,
      allSiteIds,
    );
    const merged = mergeWorkflowDeliverableFileRefs(deliverableOutputs, workflow.nodes);
    const fileRefs = filterWorkflowArchiveFileRefs(merged, deliverableScope, siteContext.name);
    if (fileRefs.length === 0) continue;
    const baseKey = config.variableKey;
    const variableKey =
      allSiteIds.length > 1
        ? `${baseKey}${workflowClientVariableSuffix(allSiteIds, siteId)}`
        : baseKey;
    const previewSource =
      resolveArchiveOutputForClient(deliverableOutputs, baseKey, siteId, allSiteIds) ??
      deliverableOutputs[deliverableOutputs.length - 1];
    const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
      nodeId: node.id,
      variableKey,
      scope: "run",
      label: config.label ?? config.variableKey,
      textPreview:
        previewSource?.textPreview ?? `${fileRefs.length} deliverable${fileRefs.length === 1 ? "" : "s"}`,
      agentRunId: previewSource?.agentRunId,
      fileRefs,
      siteId: allSiteIds.length > 1 ? siteId : undefined,
    });
    if (saved.ok && saved.output) outputs.push(saved.output);
  }

  return null;
}
