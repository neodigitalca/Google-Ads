import { patchWorkflowRun } from "@/lib/workflow/workflow-api";
import { resolveRagInputKeys } from "@/lib/workflow/workflow-rag-utils";
import { collectWorkflowRunContextBlock, resolveWorkflowSiteContext } from "@/lib/workflow/workflow-walk-helpers";
import { syncWorkflowRunArchiveDeliverables } from "@/lib/workflow/workflow-rag-archive";
import { workflowAgentUsesThenDelivery } from "@/lib/workflow/workflow-then-utils";
import { peekWorkflowCsvSequential, stashWorkflowCsvSequential } from "@/lib/workflow/workflow-csv-rows-stash";
import { isClientAgnosticExecutionKind } from "@/lib/agent-runs-types";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import { awaitAgentRunTerminal } from "@/lib/workflow/workflow-await-agent-run";
import { isLdGridCsvReceived } from "@/lib/workflow/workflow-ld-continue-watchdog";
import {
  registerParallelWorkflowChains,
  clearParallelWorkflowChains,
} from "@/lib/workflow/workflow-parallel-completion";
import { isContentGapGoalMetFromPreview } from "@/lib/workflow/workflow-run-completion";
import { readWorkflowAgentBinding } from "@/lib/workflow/workflow-agent-binding";
import type {
  WorkflowActionConfig,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRun,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";
import type { WorkflowRunCallbacks } from "@/lib/workflow/workflow-run-callbacks";
import type { WorkflowWalkClientScope } from "@/lib/workflow/workflow-client-context";
import {
  actionConfig,
  contentGapGoalMetFromAgentResult,
  resolveWorkflowSiteId,
  startWorkflowAgentForSite,
} from "@/lib/workflow/workflow-dispatch-agent-core";
import type { WalkFromNodeResult } from "@/lib/workflow/workflow-walk-types";

export async function walkWorkflowActionAgentNode(args: {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  node: WorkflowNode;
  nodeId: string;
  outputs: WorkflowStepOutput[];
  callbacks: WorkflowRunCallbacks;
  visited: Set<string>;
  walkScopeState: { current: WorkflowWalkClientScope };
  walkRemainingLinearSteps: (
    workflow: WorkflowDefinition,
    run: WorkflowRun,
    afterNodeId: string,
    outputs: WorkflowStepOutput[],
    callbacks: WorkflowRunCallbacks,
    visited: Set<string>,
    clientScope: WorkflowWalkClientScope,
  ) => Promise<WalkFromNodeResult>;
}): Promise<WalkFromNodeResult | null> {
  const {
    workflow,
    run,
    node,
    nodeId,
    outputs,
    callbacks,
    visited,
    walkScopeState,
    walkRemainingLinearSteps,
  } = args;
  if (node.kind !== "action_agent") return null;

  let walkScope = walkScopeState.current;
  const { allSiteIds } = walkScope;

    await patchWorkflowRun(workflow.teamId, workflow.id, run.id, {
      status: "running",
      currentNodeId: node.id,
    });
    const config = actionConfig(node) as WorkflowActionConfig & { compiledTaskId?: number };
    const existingOutput = outputs.find((item) => item.nodeId === node.id && item.agentRunId);
    if (existingOutput?.agentRunId) {
      const existingAgent = await fetchAgentRun(workflow.teamId, existingOutput.agentRunId);
      // Failed/cancelled prior attempts are ignored so the walk can start a fresh agent
      // (e.g. entity pages after Local Dominator finally has a grid CSV).
      // LD "Job not found" is a worker cleanup race — recover CSV or defer, never spawn another export.
      if (
        existingAgent
        && config.executionKind === "local_dominator_export"
        && (existingAgent.status === "failed" || existingAgent.status === "cancelled")
      ) {
        const binding = readWorkflowAgentBinding(existingAgent);
        if (binding) {
          const csv = await isLdGridCsvReceived(workflow.teamId, binding, existingAgent.id);
          if (csv.ready) {
            const tail = await walkRemainingLinearSteps(
              workflow,
              run,
              nodeId,
              outputs,
              callbacks,
              visited,
              walkScope,
            );
            if (!tail.ok) return tail;
            if (tail.deferWorkflowCompletion) return tail;
            return { ok: true };
          }
        }
        if (
          existingAgent.status === "failed"
          && /job not found|already cleaned up/i.test(String(existingAgent.errorMessage ?? ""))
        ) {
          return { ok: true, deferWorkflowCompletion: true };
        }
      }
      if (
        existingAgent
        && (existingAgent.status === "failed" || existingAgent.status === "cancelled")
        && config.executionKind !== "local_dominator_export"
      ) {
        const message =
          existingAgent.errorMessage?.trim()
          || (existingAgent.status === "cancelled" ? "Agent run cancelled" : "Agent run failed");
        return { ok: false, error: message };
      }
      if (
        existingAgent
        && existingAgent.status !== "cancelled"
        && existingAgent.status !== "failed"
      ) {
        if (
          existingAgent.status === "queued"
          || existingAgent.status === "running"
          || existingAgent.status === "done"
        ) {
          if (config.executionKind === "local_dominator_export") {
            if (existingAgent.status === "done") {
              const binding = readWorkflowAgentBinding(existingAgent);
              if (binding) {
                const csv = await isLdGridCsvReceived(
                  workflow.teamId,
                  binding,
                  existingAgent.id,
                );
                if (csv.ready) {
                  const tail = await walkRemainingLinearSteps(
                    workflow,
                    run,
                    nodeId,
                    outputs,
                    callbacks,
                    visited,
                    walkScope,
                  );
                  if (!tail.ok) return tail;
                  if (tail.deferWorkflowCompletion) return tail;
                  return { ok: true };
                }
              }
            }
            return { ok: true, deferWorkflowCompletion: true };
          }
          if (existingAgent.status === "queued" || existingAgent.status === "running") {
            const terminal = await awaitAgentRunTerminal(workflow.teamId, existingOutput.agentRunId);
            if (!terminal) {
              return { ok: false, error: "Agent run missing after wait" };
            }
            if (terminal.status === "cancelled" || terminal.status === "failed") {
              const message =
                terminal.errorMessage?.trim()
                || (typeof terminal.result?.message === "string" ? terminal.result.message.trim() : "")
                || "Agent run failed";
              return { ok: false, error: message };
            }
            if (
              config.executionKind === "content_gap_check"
              && contentGapGoalMetFromAgentResult(terminal.result)
            ) {
              return { ok: true };
            }
          }
          if (
            config.executionKind === "content_gap_check"
            && (
              contentGapGoalMetFromAgentResult(existingAgent.result)
              || isContentGapGoalMetFromPreview(existingOutput.textPreview)
            )
          ) {
            return { ok: true };
          }
          if (existingAgent.status === "done" || existingAgent.status === "queued" || existingAgent.status === "running") {
            const tail = await walkRemainingLinearSteps(
              workflow,
              run,
              nodeId,
              outputs,
              callbacks,
              visited,
              walkScope,
            );
            if (!tail.ok) return tail;
            if (tail.deferWorkflowCompletion) return tail;
            return { ok: true };
          }
        }
      }
    }
    const ragInputKeys = resolveRagInputKeys(config);
    const clientAgnosticAgent = isClientAgnosticExecutionKind(
      config.executionKind,
      config.executionPayload,
    );
    const sitesToRun = clientAgnosticAgent
      ? [""]
      : walkScope.activeSiteIds.length > 0
        ? walkScope.activeSiteIds
        : ([resolveWorkflowSiteId(workflow)].filter(Boolean) as string[]);
    if (sitesToRun.length === 0) {
      return { ok: false, error: "No clients selected for this workflow." };
    }

    const usesThenDelivery = workflowAgentUsesThenDelivery(workflow, node.id);
    const showAgentInSidebar = callbacks.openAgentSidebar === true;

    if (usesThenDelivery) {
      registerParallelWorkflowChains(workflow.teamId, workflow.id, run.id, sitesToRun.length);
    }

    const sequential = peekWorkflowCsvSequential(run.id);
    const sequentialForThis = sequential?.nextNodeId === node.id ? sequential : undefined;
    const rowCount = sequentialForThis?.payloads.length ?? 1;
    const startIndex = sequentialForThis?.currentIndex ?? 0;

    for (let rowIndex = startIndex; rowIndex < rowCount; rowIndex += 1) {
      if (sequentialForThis) {
        stashWorkflowCsvSequential(run.id, {
          ...sequentialForThis,
          currentIndex: rowIndex,
        });
      }

      const siteResults = await Promise.all(
        sitesToRun.map((siteId) =>
          startWorkflowAgentForSite({
            workflow,
            run,
            node,
            config,
            siteId,
            sitesToRun: allSiteIds.length > 1 ? allSiteIds : sitesToRun,
            outputs,
            contextBlock: collectWorkflowRunContextBlock(outputs, ragInputKeys, siteId, allSiteIds),
            usesThenDelivery,
            showAgentInSidebar,
            callbacks,
            ignoreExistingAgent: Boolean(sequentialForThis && rowIndex > startIndex),
          }),
        ),
      );

      const failure = siteResults.find((result) => !result.ok);
      if (failure) {
        if (usesThenDelivery) {
          clearParallelWorkflowChains(workflow.teamId, workflow.id, run.id);
        }
        return { ok: false, error: failure.error ?? "Agent run failed" };
      }

      for (const result of siteResults) {
        if (result.stepOutput) outputs.push(result.stepOutput);
      }

      await Promise.all(
        sitesToRun.map(async (siteId) => {
          const archiveOutput = await syncWorkflowRunArchiveDeliverables({
            teamId: workflow.teamId,
            workflowId: workflow.id,
            workflowRunId: run.id,
            nodes: workflow.nodes,
            outputs,
            siteId,
            clientSiteIds: allSiteIds.length > 1 ? allSiteIds : sitesToRun,
            siteName: resolveWorkflowSiteContext(siteId).name,
          });
          if (archiveOutput) outputs.push(archiveOutput);
        }),
      );

      const deferCount = siteResults.filter((result) => result.defer).length;
      if (deferCount > 0) {
        registerParallelWorkflowChains(workflow.teamId, workflow.id, run.id, deferCount);
        return { ok: true, deferWorkflowCompletion: true };
      }

      if (config.executionKind === "content_gap_check" && siteResults.length > 0) {
        const sitesNeedingPosts = sitesToRun.filter((siteId, index) => {
          const result = siteResults[index];
          return Boolean(result?.ok && result.goalMet !== true);
        });
        if (sitesNeedingPosts.length === 0) {
          return { ok: true };
        }
        walkScope = { allSiteIds, activeSiteIds: sitesNeedingPosts };
      }
    }
  walkScopeState.current = walkScope;
  return null;
}
