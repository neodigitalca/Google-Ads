import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callAgentCategoryOpenRouterChat,
  resolveModelForAgentCategory,
} from "@/lib/openrouter-agent-category-api";

describe("openrouter agent category API", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          content: '{"ok":true}',
          finishReason: "stop",
          raw: { choices: [{ message: { content: '{"ok":true}' } }] },
        }),
        text: async () => "{}",
      }) as Response),
    );
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === "neo-pulse-agent-research-model") return "google/gemini-2.5-flash-lite";
        if (key === "neo-pulse-agent-meta-model") return "google/gemini-2.5-flash";
        if (key === "neo-pulse-agent-report-model") return "google/gemini-2.5-flash-lite";
        if (key === "neo-pulse-agent-ads-model") return "google/gemini-2.5-flash-lite";
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("window", {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolveModelForAgentCategory returns distinct pipeline models", () => {
    expect(resolveModelForAgentCategory("research")).toContain("gemini");
    expect(resolveModelForAgentCategory("meta")).toContain("gemini");
    expect(resolveModelForAgentCategory("report")).toContain("gemini");
    expect(resolveModelForAgentCategory("ads")).toContain("gemini");
  });

  it("posts to app OpenRouter route for research category", async () => {
    await callAgentCategoryOpenRouterChat({
      category: "research",
      apiKey: "test-key",
      system: "sys",
      user: "user",
      maxTokens: 64,
    });
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain("/api/openrouter/chat-completion");
    expect(url).not.toContain("openrouter.ai");
  });
});
