import { patchWorkflowRun, saveWorkflowStepOutput } from "@/lib/workflow/workflow-api";
import { resolveWorkflowSiteContext } from "@/lib/workflow/workflow-walk-helpers";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import { executeWorkflowThenStep } from "@/lib/workflow/workflow-then-runner";
import { thenConfig, workflowThenOutputExistsForSite } from "@/lib/workflow/workflow-then-utils";
import { workflowRunThenEmailAlreadySent } from "@/lib/workflow/workflow-then-aggregate";
import {
  awaitThenUpstreamTerminal,
  shouldDeferThenStepForParallelWait,
} from "@/lib/workflow/workflow-then-wait";
import { findUpstreamActionAgent } from "@/lib/workflow/workflow-graph-mutations";
import { filterWorkflowOutputsForSite } from "@/lib/workflow/workflow-rag-client";
import type {
  WorkflowActionConfig,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRun,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";
import { isWorkflowThenKind } from "@/lib/workflow/workflow-types";
import type { WorkflowRunCallbacks } from "@/lib/workflow/workflow-run-callbacks";
import type { WorkflowWalkClientScope } from "@/lib/workflow/workflow-client-context";
import { resolveWorkflowSiteId } from "@/lib/workflow/workflow-dispatch-agent-core";
import type { WalkFromNodeResult } from "@/lib/workflow/workflow-walk-types";

export async function walkWorkflowThenNode(args: {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  node: WorkflowNode;
  outputs: WorkflowStepOutput[];
  callbacks: WorkflowRunCallbacks;
  walkScope: WorkflowWalkClientScope;
  allSiteIds: string[];
}): Promise<WalkFromNodeResult | null> {
  const { workflow, run, node, outputs, callbacks, walkScope, allSiteIds } = args;
  if (!isWorkflowThenKind(node.kind)) return null;

  const config = thenConfig(node);
  const runWorkflowWideEmail =
    node.kind === "then_email" && config.emailBatchScope === "workflow_run";
  const sitesForThen =
    walkScope.activeSiteIds.length > 0
      ? walkScope.activeSiteIds
      : ([resolveWorkflowSiteId(workflow)].filter(Boolean) as string[]);
  const pendingSites = runWorkflowWideEmail
    ? sitesForThen
    : sitesForThen.filter((siteId) => !workflowThenOutputExistsForSite(outputs, node.id, siteId));
  const thenAlreadyDone = runWorkflowWideEmail
    ? workflowRunThenEmailAlreadySent(outputs, node.id)
    : pendingSites.length === 0 && sitesForThen.length > 0;

  if (thenAlreadyDone) {
    return null;
  }

  await patchWorkflowRun(workflow.teamId, workflow.id, run.id, {
    status: "running",
    currentNodeId: node.id,
  });
  const waitCtx = { teamId: workflow.teamId, workflowId: workflow.id, runId: run.id };

  if (shouldDeferThenStepForParallelWait(node, waitCtx)) {
    return { ok: true, deferWorkflowCompletion: true };
  }

  const folderTestOnly =
    callbacks.stopAfterNodeId === node.id && node.kind === "then_google_drive";

  const upstreamReady = folderTestOnly
    ? true
    : await awaitThenUpstreamTerminal(node, outputs, workflow.teamId);
  if (!upstreamReady) {
    return { ok: false, error: "Upstream deliverables are not ready yet." };
  }

  const upstreamAgent = findUpstreamActionAgent(workflow, node.id);
  const executionKind = upstreamAgent
    ? String((upstreamAgent.config as WorkflowActionConfig).executionKind ?? "")
    : undefined;

  if (runWorkflowWideEmail) {
    if (workflowRunThenEmailAlreadySent(outputs, node.id)) {
      return null;
    }
    const primarySiteId = sitesForThen[0] ?? resolveWorkflowSiteId(workflow) ?? "";
    const siteContext = resolveWorkflowSiteContext(primarySiteId || undefined);
    const thenResult = await executeWorkflowThenStep(node, outputs, {
      workflow,
      siteId: primarySiteId || undefined,
      siteName: siteContext.name,
      siteUrl: siteContext.url,
      executionKind,
      allSiteIds,
      allOutputs: outputs,
      folderTestOnly,
    });
    if (!thenResult.ok) {
      return { ok: false, error: thenResult.error ?? "Then step failed" };
    }
    if (thenResult.output) {
      const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
        nodeId: node.id,
        variableKey: thenResult.output.variableKey,
        scope: "run",
        label: thenResult.output.label,
        textPreview: thenResult.output.textPreview,
        agentRunId: thenResult.output.agentRunId,
        fileRefs: thenResult.output.fileRefs,
        deliveryMeta: thenResult.output.deliveryMeta,
      });
      if (saved.ok && saved.output) outputs.push(saved.output);
    }
    return null;
  }

  const thenResults = await Promise.all(
    pendingSites.map(async (siteId) => {
      const siteContext = resolveWorkflowSiteContext(siteId);
      const siteOutputs = filterWorkflowOutputsForSite(outputs, siteId, allSiteIds);
      return executeWorkflowThenStep(node, siteOutputs, {
        workflow,
        siteId,
        siteName: siteContext.name,
        siteUrl: siteContext.url,
        executionKind,
        allSiteIds,
        allOutputs: outputs,
        folderTestOnly,
      });
    }),
  );

  const thenFailure = thenResults.find((result) => !result.ok);
  if (thenFailure) {
    return { ok: false, error: thenFailure.error ?? "Then step failed" };
  }

  for (let index = 0; index < thenResults.length; index += 1) {
    const thenResult = thenResults[index]!;
    if (!thenResult.output) continue;
    const siteId = pendingSites[index]!;
    const thenVariableKey =
      allSiteIds.length > 1
        ? `${thenResult.output.variableKey}${workflowClientVariableSuffix(allSiteIds, siteId)}`
        : thenResult.output.variableKey;
    const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
      nodeId: node.id,
      variableKey: thenVariableKey,
      scope: "run",
      label: thenResult.output.label,
      textPreview: thenResult.output.textPreview,
      agentRunId: thenResult.output.agentRunId,
      fileRefs: thenResult.output.fileRefs,
      deliveryMeta: thenResult.output.deliveryMeta,
      siteId,
    });
    if (saved.ok && saved.output) outputs.push(saved.output);
  }

  return null;
}
