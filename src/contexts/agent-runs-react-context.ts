import { createContext } from "react";
import type { AgentRunsContextValue } from "@/contexts/agent-runs-context-value";

export const AgentRunsContext = createContext<AgentRunsContextValue | null>(null);
