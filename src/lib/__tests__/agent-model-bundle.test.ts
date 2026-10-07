import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAgentModelsForSite } from "@/lib/agent-model-bundle";

describe("resolveAgentModelsForSite", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === "optimization_settings_site-1") {
          return JSON.stringify({
            model: "openai/gpt-5",
            researchModel: "openai/gpt-5-mini",
            metaModel: "openai/gpt-5-mini",
            reportModel: "openai/gpt-5-mini",
            adsModel: "openai/gpt-5-mini",
            imageModel: "google/gemini-2.5-flash-image",
          });
        }
        if (key === "neo-pulse-agent-blog-model") return "google/gemini-2.5-flash";
        if (key === "neo-pulse-agent-research-model") return "deepseek/deepseek-v4.1-flash";
        if (key === "neo-pulse-agent-image-model") return "google/gemini-2.5-flash-image-preview";
        if (key === "neo-pulse-agent-meta-model") return "google/gemini-2.5-flash";
        if (key === "neo-pulse-agent-report-model") return "deepseek/deepseek-v4.1-flash";
        if (key === "neo-pulse-agent-ads-model") return "deepseek/deepseek-v4.1-flash";
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns per-site models when site settings exist", () => {
    const bundle = resolveAgentModelsForSite("site-1");
    expect(bundle.blog).toBe("openai/gpt-5");
    expect(bundle.research).toBe("openai/gpt-5-mini");
    expect(bundle.image).toBe("google/gemini-2.5-flash-image");
    expect(bundle.meta).toBe("openai/gpt-5-mini");
    expect(bundle.report).toBe("openai/gpt-5-mini");
    expect(bundle.ads).toBe("openai/gpt-5-mini");
  });

  it("returns global defaults when no site id", () => {
    const bundle = resolveAgentModelsForSite();
    expect(bundle.blog).toBe("google/gemini-2.5-flash");
    expect(bundle.research).toBe("deepseek/deepseek-v4.1-flash");
    expect(bundle.image).toBe("google/gemini-2.5-flash-image-preview");
    expect(bundle.meta).toBe("google/gemini-2.5-flash");
    expect(bundle.report).toBe("deepseek/deepseek-v4.1-flash");
    expect(bundle.ads).toBe("deepseek/deepseek-v4.1-flash");
  });
});
