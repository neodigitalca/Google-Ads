import type { StartAgentRunPayload } from "@/lib/agent-runs-types";
import { isAgentRunTerminal, taskExecutionKindToRecipe, type AgentRun } from "@/lib/agent-runs-types";
import {
  resolveStepOutputFileRefsWithRetry,
} from "@/lib/workflow/workflow-step-file-refs";
import type { TaskExecutionKind, TaskExecutionPayload, TeamTask } from "@/lib/tasks-types";
import { browserAutomationRequiresClient } from "@/lib/browser-automation/resolve-browser-target-url";
import { isClientAgnosticExecutionKind } from "@/lib/agent-runs-types";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import { patchWorkflowRun, saveWorkflowStepOutput } from "@/lib/workflow/workflow-api";
import { resolveArchiveOutputForClient, resolveRagInputKeys } from "@/lib/workflow/workflow-rag-utils";
import {
  applyLocalDominatorWorkflowKeyword,
  collectWorkflowRunContextBlock,
  resolveWorkflowSiteContext,
} from "@/lib/workflow/workflow-walk-helpers";
import {
  buildWorkflowWalkClientScope,
  type WorkflowWalkClientScope,
} from "@/lib/workflow/workflow-client-context";
import {
  filterWorkflowArchiveFileRefs,
  mergeWorkflowDeliverableFileRefs,
  syncWorkflowRunArchiveDeliverables,
} from "@/lib/workflow/workflow-rag-archive";
import {
  resolveWorkflowClientSiteIds,
  workflowClientVariableSuffix,
} from "@/lib/workflow/workflow-client-config";
import { pickPathBranchId } from "@/lib/workflow/workflow-path-evaluator";
import { executeWorkflowThenStep } from "@/lib/workflow/workflow-then-runner";
import {
  mergeThenStepScheduleIntoPayload,
  stripWorkflowAgentDeliveryPayload,
  thenConfig,
  workflowAgentUsesThenDelivery,
  workflowThenOutputExistsForSite,
} from "@/lib/workflow/workflow-then-utils";
import {
  applyWorkflowTriggerScheduleToPayload,
} from "@/lib/workflow/workflow-agent-plan";
import { workflowRunThenEmailAlreadySent } from "@/lib/workflow/workflow-then-aggregate";
import {
  awaitThenUpstreamTerminal,
  shouldDeferThenStepForParallelWait,
} from "@/lib/workflow/workflow-then-wait";
import { findClientNode, nodeById, outgoingEdges } from "@/lib/workflow/workflow-graph-utils";
import {
  applyContentGapPostCountToPostCreatorPayload,
  resolveUpstreamContentGapPostCount,
} from "@/lib/workflow/resolve-workflow-content-gap-post-count";
import { fetchTaskDetail } from "@/lib/tasks-api";
import { resolveDfsArticleAuditWorkflowPayload } from "@/lib/workflow/resolve-dfs-article-audit-workflow-payload";
import { ensureChatGptAuditExecutionPayload } from "@/lib/workflow/resolve-chatgpt-audit-workflow-payload";
import { resolveWorkflowActionPayload } from "@/lib/workflow/resolve-workflow-action-payload";
import { applyCsvRowsPayloadForNode } from "@/lib/workflow/apply-csv-rows-payload";
import {
  attachPageAuditCsvToAgentRun,
  ensureWorkflowCsvRowsStashForAction,
  executeWorkflowCsvRowsStep,
  persistPageAuditCsvToNextTask,
} from "@/lib/workflow/workflow-csv-rows-runner";
import { csvTextToDataHref } from "@/lib/workflow/workflow-rag-run-files";
import { peekWorkflowCsvSequential, stashWorkflowCsvSequential } from "@/lib/workflow/workflow-csv-rows-stash";
import { applyUpstreamContextToPostCreatorPayload } from "@/lib/workflow/upstream-research-facts";
import { getStoredSites } from "@/components/integrations/storage";
import type {
  WorkflowActionConfig,
  WorkflowClientConfig,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowPathRulesConfig,
  WorkflowRagArchiveConfig,
  WorkflowRun,
  WorkflowStepOutput,
} from "@/lib/workflow/workflow-types";
import { isWorkflowThenKind } from "@/lib/workflow/workflow-types";
import { awaitAgentRunTerminal } from "@/lib/workflow/workflow-await-agent-run";
import { isLdGridCsvReceived } from "@/lib/workflow/workflow-ld-continue-watchdog";
import {
  findWorkflowNodeAgentRun,
} from "@/lib/workflow/workflow-node-agent-dedupe";
import {
  completeParallelWorkflowChain,
  registerParallelWorkflowChains,
  clearParallelWorkflowChains,
} from "@/lib/workflow/workflow-parallel-completion";
import { isContentGapGoalMetFromPreview, workflowNodeHasReadyRunOutput } from "@/lib/workflow/workflow-run-completion";
import { linearExecutableTailNodes } from "@/lib/workflow/workflow-linear-tail";
import { findUpstreamActionAgent, linearOrderedNodes } from "@/lib/workflow/workflow-graph-mutations";
import { filterWorkflowOutputsForSite, clientDeliverableOutputs } from "@/lib/workflow/workflow-rag-client";
import { runAgentMailEmailIntake } from "@/lib/agentmail/agentmail-email-intake";
import { isGridCsvFileRef } from "@/lib/entity-page-creator/resolve-upstream-grid-csv";
import type { WorkflowRunCallbacks } from "@/lib/workflow/workflow-run-callbacks";
import type { WalkFromNodeResult } from "@/lib/workflow/workflow-walk-types";
import { walkWorkflowThenNode } from "@/lib/workflow/workflow-dispatch-then-node";
import { walkWorkflowRagArchiveNode } from "@/lib/workflow/workflow-dispatch-rag-archive-node";

import {
  startWorkflowAgentForSite,
  contentGapGoalMetFromAgentResult,
  actionConfig,
  workflowActionStartsFromCompiledTask,
  workflowRequiresClient,
  pathConfig,
  resolveWorkflowSiteId,
} from "@/lib/workflow/workflow-dispatch-agent-core";
import { readWorkflowAgentBinding } from "@/lib/workflow/workflow-agent-binding";

function resolveWorkflowResumeNodeId(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  outputs: WorkflowStepOutput[],
  defaultNodeId: string,
): string {
  for (const node of linearOrderedNodes(workflow)) {
    if (node.kind !== "action_agent" && !isWorkflowThenKind(node.kind) && node.kind !== "rag_archive" && node.kind !== "csv_rows") {
      continue;
    }
    if (!workflowNodeHasReadyRunOutput(node, outputs)) return node.id;
  }
  return defaultNodeId;
}

function resolveWorkflowWalkEntryNodeId(
  workflow: Pick<WorkflowDefinition, "nodes" | "edges">,
  outputs: WorkflowStepOutput[],
  defaultNodeId: string,
  stopAfterNodeId?: string,
): string {
  if (stopAfterNodeId) {
    const stopNode = workflow.nodes.find((node) => node.id === stopAfterNodeId);
    if (stopNode?.kind === "then_google_drive") {
      return stopAfterNodeId;
    }
  }
  return resolveWorkflowResumeNodeId(workflow, outputs, defaultNodeId);
}

async function walkRemainingLinearSteps(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  afterNodeId: string,
  outputs: WorkflowStepOutput[],
  callbacks: WorkflowRunCallbacks,
  visited: Set<string>,
  clientScope: WorkflowWalkClientScope,
): Promise<WalkFromNodeResult> {
  for (const tailNode of linearExecutableTailNodes(workflow, afterNodeId)) {
    if (visited.has(tailNode.id)) continue;
    const next = await walkFromNode(
      workflow,
      run,
      tailNode.id,
      outputs,
      callbacks,
      visited,
      clientScope,
    );
    if (!next.ok) return next;
    if (next.deferWorkflowCompletion) return next;
  }
  return { ok: true };
}

async function walkFromNode(
  workflow: WorkflowDefinition,
  run: WorkflowRun,
  nodeId: string,
  outputs: WorkflowStepOutput[],
  callbacks: WorkflowRunCallbacks,
  visited: Set<string>,
  clientScope: WorkflowWalkClientScope,
): Promise<WalkFromNodeResult> {
  let walkScope = clientScope;
  const { allSiteIds } = walkScope;
  if (visited.has(nodeId)) return { ok: true };
  visited.add(nodeId);
  const node = nodeById(workflow.nodes, nodeId);
  if (!node) return { ok: true };

  if (node.kind === "path_rules") {
    const branchId = pickPathBranchId(pathConfig(node).branches, {
      triggerPayload: run.triggerPayload,
      stepOutputs: outputs,
    });
    const edge = outgoingEdges(workflow.edges, nodeId, branchId)[0]
      ?? outgoingEdges(workflow.edges, nodeId, "default")[0]
      ?? outgoingEdges(workflow.edges, nodeId)[0];
    if (!edge) return { ok: true };
    return walkFromNode(workflow, run, edge.target, outputs, callbacks, visited, walkScope);
  }

  if (node.kind === "csv_rows") {
    await patchWorkflowRun(workflow.teamId, workflow.id, run.id, {
      status: "running",
      currentNodeId: node.id,
    });
    try {
      const csvConfig = (node.config ?? {}) as { ragVariableKey?: string; csvInputSource?: string };
      const siteSource = csvConfig.csvInputSource === "site";
      const sitesToAudit = siteSource
        ? walkScope.activeSiteIds.length > 0
          ? walkScope.activeSiteIds
          : ([resolveWorkflowSiteId(workflow)].filter(Boolean) as string[])
        : [""];
      if (siteSource && sitesToAudit.length === 0) {
        return { ok: false, error: "No clients selected for this workflow." };
      }
      const nextEdge = outgoingEdges(workflow.edges, node.id)[0];
      const nextNode = nextEdge ? nodeById(workflow.nodes, nextEdge.target) : undefined;
      const fanOutAgent = nextNode?.kind === "action_agent" ? nextNode : undefined;
      const fanOutConfig = fanOutAgent
        ? (actionConfig(fanOutAgent) as WorkflowActionConfig & { compiledTaskId?: number })
        : undefined;
      const siteResults = await Promise.all(
        sitesToAudit.map(async (siteId) => {
          try {
          callbacks.onClientProgress?.("Page audit…", siteId || undefined);
          const executed = await executeWorkflowCsvRowsStep({
            teamId: workflow.teamId,
            workflowRunId: run.id,
            workflow,
            node,
            outputs,
            siteId: siteId || undefined,
          });
          const baseKey = csvConfig.ragVariableKey ?? `csv_${node.id}`;
          const variableKey = `${baseKey}${workflowClientVariableSuffix(allSiteIds, siteId)}`;
          const saved = await saveWorkflowStepOutput(workflow.teamId, workflow.id, run.id, {
            nodeId: node.id,
            variableKey,
            scope: "run",
            label: node.label,
            textPreview: executed.csvText,
            fileRefs: [
              {
                name: executed.fileName,
                mime: "text/csv",
                url: csvTextToDataHref(executed.csvText),
              },
            ],
            siteId: siteId || undefined,
          });
          await persistPageAuditCsvToNextTask({
            teamId: workflow.teamId,
            workflow,
            csvNodeId: node.id,
            fileName: executed.fileName,
            csvText: executed.csvText,
          });
          const output = saved.ok && saved.output ? saved.output : null;
          if (!fanOutAgent || !fanOutConfig) {
            return { output, agentResult: null };
          }
          callbacks.onClientProgress?.("Starting Full AISEO…", siteId || undefined);
          const ragInputKeys = resolveRagInputKeys(fanOutConfig);
          const agentOutputs = output ? [...outputs, output] : outputs;
          const agentResult = await startWorkflowAgentForSite({
            workflow,
            run,
            node: fanOutAgent,
            config: fanOutConfig,
            siteId,
            sitesToRun: allSiteIds.length > 1 ? allSiteIds : sitesToAudit,
            outputs: agentOutputs,
            contextBlock: collectWorkflowRunContextBlock(agentOutputs, ragInputKeys, siteId, allSiteIds),
            usesThenDelivery: workflowAgentUsesThenDelivery(workflow, fanOutAgent.id),
            showAgentInSidebar: callbacks.openAgentSidebar === true,
            callbacks,
          });
          return { output, agentResult };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "CSV rows step failed";
            callbacks.onClientProgress?.(message, siteId || undefined);
            return {
              output: null,
              agentResult: { ok: false as const, error: message, siteId },
            };
          }
        }),
      );
      for (const row of siteResults) {
        if (row.output) outputs.push(row.output);
        if (row.agentResult?.stepOutput) outputs.push(row.agentResult.stepOutput);
      }
      const failedAgents = siteResults.filter((row) => row.agentResult && !row.agentResult.ok);
      if (failedAgents.length > 0 && failedAgents.length === siteResults.length) {
        return {
          ok: false,
          error: failedAgents[0]?.agentResult?.error ?? "Agent run failed",
        };
      }
      if (fanOutAgent) {
        visited.add(fanOutAgent.id);
        if (callbacks.stopAfterNodeId === fanOutAgent.id) {
          return { ok: true };
        }
        const afterAgent = outgoingEdges(workflow.edges, fanOutAgent.id)[0];
        if (!afterAgent) {
          return { ok: true };
        }
        return walkFromNode(
          workflow,
          run,
          afterAgent.target,
          outputs,
          callbacks,
          visited,
          walkScope,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "CSV rows step failed";
      return { ok: false, error: message };
    }
  }

  if (node.kind === "action_agent") {
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
  }

  const thenWalk = await walkWorkflowThenNode({
    workflow,
    run,
    node,
    outputs,
    callbacks,
    walkScope,
    allSiteIds,
  });
  if (thenWalk) return thenWalk;

  const ragWalk = await walkWorkflowRagArchiveNode({
    workflow,
    run,
    node,
    outputs,
    walkScope,
    allSiteIds,
  });
  if (ragWalk) return ragWalk;

  if (callbacks.stopAfterNodeId === nodeId) {
    return { ok: true };
  }

  for (const edge of outgoingEdges(workflow.edges, nodeId)) {
    const next = await walkFromNode(workflow, run, edge.target, outputs, callbacks, visited, walkScope);
    if (!next.ok) return next;
    if (next.deferWorkflowCompletion) {
      return { ok: true, deferWorkflowCompletion: true };
    }
  }

  const linearTail = await walkRemainingLinearSteps(
    workflow,
    run,
    nodeId,
    outputs,
    callbacks,
    visited,
    walkScope,
  );
  if (!linearTail.ok) return linearTail;
  if (linearTail.deferWorkflowCompletion) return linearTail;

  return { ok: true };
}

export {
  walkFromNode,
  walkRemainingLinearSteps,
  workflowRequiresClient,
  resolveWorkflowResumeNodeId,
  resolveWorkflowWalkEntryNodeId,
  actionConfig,
  contentGapGoalMetFromAgentResult,
  workflowActionStartsFromCompiledTask,
};

