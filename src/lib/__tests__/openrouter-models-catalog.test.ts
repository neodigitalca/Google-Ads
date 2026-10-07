import { describe, expect, it } from "vitest";
import { modelMatchesOpenRouterQuery } from "@/lib/openrouter-models-catalog";

describe("modelMatchesOpenRouterQuery", () => {
  const localEntry = { id: "qwen3:8b", name: "qwen3:8b", local: true };
  const remoteEntry = { id: "qwen/qwen3-max", name: "Qwen3 Max" };

  it("never matches legacy local rows", () => {
    expect(modelMatchesOpenRouterQuery(localEntry, "")).toBe(false);
    expect(modelMatchesOpenRouterQuery(localEntry, "qwen3")).toBe(false);
    expect(modelMatchesOpenRouterQuery(localEntry, "local")).toBe(false);
  });

  it("matches remote id fragments", () => {
    expect(modelMatchesOpenRouterQuery(remoteEntry, "qwen3")).toBe(true);
    expect(modelMatchesOpenRouterQuery(remoteEntry, "gemini")).toBe(false);
  });
});
