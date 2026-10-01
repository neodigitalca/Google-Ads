import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getBlogModel,
  getImageModel,
  getProductionModel,
  getResearchModel,
  saveOptimizationSettings,
} from "@/lib/optimization-settings-storage";

const SITE = "site-agent-routing-test";

describe("optimization settings — three pipeline agents", () => {
  beforeEach(() => {
    localStorage.clear();
    saveOptimizationSettings(SITE, {
      model: "blog/model",
      researchModel: "research/model",
      imageModel: "image/model",
      customModels: [],
      temperature: 1,
      maxTokens: 4000,
      topP: 0.9,
    });
  });

  it("routes research, blog, and image models independently per site", () => {
    expect(getResearchModel(SITE)).toBe("research/model");
    expect(getProductionModel(SITE)).toBe("blog/model");
    expect(getBlogModel(SITE)).toBe("blog/model");
    expect(getImageModel(SITE)).toBe("image/model");
  });
});
