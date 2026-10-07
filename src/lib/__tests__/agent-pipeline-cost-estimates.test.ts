import { describe, expect, it } from "vitest";
import {
  estimateAgentRunCostUsd,
  estimateTextLlmCostUsd,
  RESEARCH_REFERENCE_INPUT_TOKENS,
  RESEARCH_REFERENCE_OUTPUT_TOKENS,
} from "@/lib/agent-pipeline-cost-estimates";

describe("agent-pipeline-cost-estimates", () => {
  it("computes text LLM cost from per-token pricing", () => {
    const usd = estimateTextLlmCostUsd(
      { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000002 },
      1_000_000,
      500_000,
    );
    expect(usd).toBe(2);
  });

  it("returns research estimate label with reference tokens", () => {
    const { usd, label } = estimateAgentRunCostUsd({
      agent: "research",
      modelId: "test/model",
      catalog: [
        {
          id: "test/model",
          name: "Test",
          promptUsdPerToken: 0.000001,
          completionUsdPerToken: 0.000002,
          imageUsdPerToken: null,
          contextLength: null,
          textOutput: true,
          imageOutput: false,
        },
      ],
    });
    expect(usd).toBeCloseTo(
      RESEARCH_REFERENCE_INPUT_TOKENS * 0.000001 +
        RESEARCH_REFERENCE_OUTPUT_TOKENS * 0.000002,
      6,
    );
    expect(label).toContain("typical research run");
  });

  it("reports pricing unavailable without catalog entry", () => {
    const { usd, label } = estimateAgentRunCostUsd({
      agent: "blog",
      modelId: "missing/model",
      catalog: [],
    });
    expect(usd).toBeNull();
    expect(label).toContain("Pricing unavailable");
  });
});
