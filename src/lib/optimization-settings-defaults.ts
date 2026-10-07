import { DEFAULT_IMAGE_MODEL } from "@/lib/image-model-defaults";

export interface OptimizationSettings {
  /** Blog agent: harness sections, title, meta description */
  model: string;
  /** Research agent: checklist, blueprint, briefs, image planning */
  researchModel: string;
  /** Meta agent: SAP/blog meta descriptions and FAQ copy */
  metaModel: string;
  /** Report agent: GSC reporting and analytics LLM */
  reportModel: string;
  /** Ads agent: Google Ads and Meta PPC copy */
  adsModel: string;
  /** Image agent: OpenRouter image generation */
  imageModel: string;
  customModels: string[];
  temperature: number;
  maxTokens: number;
  topP: number;
}

export const DEFAULT_SETTINGS: OptimizationSettings = {
  model: "google/gemini-2.5-flash",
  researchModel: "deepseek/deepseek-v4.1-flash",
  metaModel: "google/gemini-2.5-flash",
  reportModel: "deepseek/deepseek-v4.1-flash",
  adsModel: "deepseek/deepseek-v4.1-flash",
  imageModel: DEFAULT_IMAGE_MODEL,
  customModels: [],
  temperature: 1.0,
  maxTokens: 4000,
  topP: 0.9,
};
