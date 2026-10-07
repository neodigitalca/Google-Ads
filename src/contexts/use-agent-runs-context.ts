import { useContext } from "react";
import { AgentRunsContext } from "@/contexts/agent-runs-react-context";
import type { AgentRunsContextValue } from "@/contexts/agent-runs-context-value";

export function useAgentRunsContext(): AgentRunsContextValue {
  const ctx = useContext(AgentRunsContext);
  if (!ctx) {
    throw new Error("useAgentRunsContext must be used within AgentRunsContextProvider");
  }
  return ctx;
}
