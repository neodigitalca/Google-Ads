import type { AgentRunListPatch } from "@/lib/agent-runs/agent-runs-local-patch";
import type { AgentRun, StartAgentRunPayload } from "@/lib/agent-runs-types";
import type { SidebarPanel } from "@/lib/pulse-assist/storage";
import type { TeamTask } from "@/lib/tasks-types";

export type AgentRunsContextValue = {
  runs: AgentRun[];
  selectedRunId: number | null;
  selectedRun: AgentRun | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarPanel: SidebarPanel;
  setSidebarPanel: (panel: SidebarPanel) => void;
  agentsSiteFilter: string;
  setAgentsSiteFilter: (siteId: string) => void;
  openSidebar: (runId?: number) => void;
  seedOptimisticWorkflowAgent: (title: string, siteId?: string | readonly string[]) => void;
  patchOptimisticWorkflowAgentProgress: (message: string, siteId?: string) => void;
  selectRun: (runId: number | null) => void;
  refreshRuns: () => Promise<void>;
  patchRunInList: (runId: number, patch: AgentRunListPatch) => void;
  startRun: (
    payload: StartAgentRunPayload,
    options?: {
      openSidebar?: boolean;
      workflowBinding?: {
        workflowId: number;
        workflowRunId: number;
        workflowNodeId: string;
        ragVariableKey?: string;
        workflowThenDelivery?: boolean;
      };
    },
  ) => Promise<{ ok: boolean; run?: AgentRun; error?: string }>;
  startRunFromTask: (
    task: TeamTask,
    options?: {
      openSidebar?: boolean;
      workflowBinding?: {
        workflowId: number;
        workflowRunId: number;
        workflowNodeId: string;
        ragVariableKey?: string;
        workflowThenDelivery?: boolean;
      };
    },
  ) => Promise<{ ok: boolean; run?: AgentRun; error?: string }>;
  dispatchWorkflowRun: (
    workflowId: number,
    runId: number,
    options?: {
      openAgentSidebar?: boolean;
      stopAfterNodeId?: string;
      clientSiteId?: string;
      skipSetupSteps?: boolean;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  cancelRun: (runId: number) => Promise<void>;
  resumeRun: (runId: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  cancelActiveRuns: () => Promise<void>;
  hasTerminalHistory: boolean;
};
