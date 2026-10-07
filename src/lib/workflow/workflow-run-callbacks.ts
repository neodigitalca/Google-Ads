import type { StartAgentRunPayload } from "@/lib/agent-runs-types";
import type { TeamTask } from "@/lib/tasks-types";

export type WorkflowAgentBinding = {
  workflowId: number;
  workflowRunId: number;
  workflowNodeId: string;
  ragVariableKey?: string;
  workflowThenDelivery?: boolean;
};

type WorkflowStartRunResult = {
  ok: boolean;
  run?: { id: number; status: string; result?: Record<string, unknown> };
  error?: string;
};

export type WorkflowRunCallbacks = {
  startRun: (
    payload: StartAgentRunPayload,
    options?: {
      openSidebar?: boolean;
      workflowBinding?: WorkflowAgentBinding;
    },
  ) => Promise<WorkflowStartRunResult>;
  startRunAndWait?: (
    payload: StartAgentRunPayload,
    options?: {
      openSidebar?: boolean;
      workflowBinding?: WorkflowAgentBinding;
    },
  ) => Promise<WorkflowStartRunResult>;
  startRunFromTask?: (
    task: TeamTask,
    options?: { openSidebar?: boolean; workflowBinding?: WorkflowAgentBinding },
  ) => Promise<WorkflowStartRunResult>;
  startRunFromTaskAndWait?: (
    task: TeamTask,
    options?: { openSidebar?: boolean; workflowBinding?: WorkflowAgentBinding },
  ) => Promise<WorkflowStartRunResult>;
  listAvailableSiteIds?: () => string[] | Promise<string[]>;
  openAgentSidebar?: boolean;
  stopAfterNodeId?: string;
  skipSetupSteps?: boolean;
  onClientProgress?: (message: string, siteId?: string) => void;
};
