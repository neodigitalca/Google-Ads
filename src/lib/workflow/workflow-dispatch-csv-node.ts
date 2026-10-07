import { patchWorkflowRun, saveWorkflowStepOutput } from "@/lib/workflow/workflow-api";
import { resolveRagInputKeys } from "@/lib/workflow/workflow-rag-utils";
import { collectWorkflowRunContextBlock } from "@/lib/workflow/workflow-walk-helpers";
import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import {
  executeWorkflowCsvRowsStep,
  persistPageAuditCsvToNextTask,
} from "@/lib/workflow/workflow-csv-rows-runner";
import { csvTextToDataHref } from "@/lib/workflow/workflow-rag-run-files";
import { nodeById, outgoingEdges } from "@/lib/workflow/workflow-graph-utils";
import { workflowAgentUsesThenDelivery } from "@/lib/workflow/workflow-then-utils";
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
  resolveWorkflowSiteId,
  startWorkflowAgentForSite,
} from "@/lib/workflow/workflow-dispatch-agent-core";
import type { WalkFromNodeResult } from "@/lib/workflow/workflow-walk-types";

export async function walkWorkflowCsvRowsNode(args: {
  workflow: WorkflowDefinition;
  run: WorkflowRun;
  node: WorkflowNode;
  nodeId: string;
  outputs: WorkflowStepOutput[];
  callbacks: WorkflowRunCallbacks;
  visited: Set<string>;
  walkScope: WorkflowWalkClientScope;
  allSiteIds: string[];
  walkFromNode: (
    workflow: WorkflowDefinition,
    run: WorkflowRun,
    nodeId: string,
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
    outputs,
    callbacks,
    visited,
    walkScope,
    allSiteIds,
    walkFromNode,
  } = args;
  if (node.kind !== "csv_rows") return null;

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

  return null;
}
