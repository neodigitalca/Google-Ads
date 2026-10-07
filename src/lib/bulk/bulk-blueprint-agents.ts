import type { AgentConfig } from "@/types/agent-config";
import { flowFreeformSectionsToAgents } from "@/lib/flow-freeform/flow-freeform-types";
import type { FlowFreeformSectionPlan } from "@/lib/flow-freeform/flow-freeform-types";

export function resolveAgentsForBulk(blueprint: {
  agents?: AgentConfig[];
  blueprintVersion?: number;
  flowFreeform?: { sections: FlowFreeformSectionPlan[] };
}): AgentConfig[] {
  const bp = blueprint as {
    agents?: AgentConfig[];
    blueprintVersion?: number;
    flowFreeform?: { sections: FlowFreeformSectionPlan[] };
  };
  return bp.blueprintVersion === 2 && bp.flowFreeform?.sections?.length
    ? flowFreeformSectionsToAgents(bp.flowFreeform.sections)
    : bp.agents ?? [];
}
