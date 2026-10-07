import { describe, expect, it } from "vitest";
import { coerceOpenRouterModelId, isOpenRouterRemoteModelId } from "@/lib/openrouter-model-id";

describe("openrouter-model-id", () => {
  it("accepts OpenRouter provider/model ids", () => {
    expect(isOpenRouterRemoteModelId("google/gemini-2.5-flash")).toBe(true);
    expect(isOpenRouterRemoteModelId("deepseek/deepseek-v4.1-flash")).toBe(true);
  });

  it("rejects legacy local Ollama ids", () => {
    expect(isOpenRouterRemoteModelId("qwen2.5:14b")).toBe(false);
    expect(isOpenRouterRemoteModelId("qwen3:8b")).toBe(false);
  });

  it("coerces invalid stored ids to fallback", () => {
    expect(coerceOpenRouterModelId("qwen2.5:14b", "google/gemini-2.5-flash")).toBe(
      "google/gemini-2.5-flash",
    );
    expect(coerceOpenRouterModelId("google/gemini-2.5-flash", "x/y")).toBe(
      "google/gemini-2.5-flash",
    );
  });
});
