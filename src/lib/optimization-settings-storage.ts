import type { OptimizationSettings } from "@/lib/optimization-settings-defaults";
import { DEFAULT_SETTINGS } from "@/lib/optimization-settings-defaults";
import { DEFAULT_IMAGE_MODEL } from "@/lib/image-model-defaults";
import {
  readGlobalAdsAgentModel,
  readGlobalBlogAgentModel,
  readGlobalImageAgentModel,
  readGlobalMetaAgentModel,
  readGlobalReportAgentModel,
  readGlobalResearchAgentModel,
} from "@/lib/global-agent-models";
import { coerceOpenRouterModelId } from "@/lib/openrouter-model-id";

const SETTINGS_STORAGE_KEY_PREFIX = "optimization_settings_";
const MODE_STORAGE_KEY_PREFIX = "optimization_mode_";

export function getOptimizationSettings(siteId: string): OptimizationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(`${SETTINGS_STORAGE_KEY_PREFIX}${siteId}`);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<OptimizationSettings>;
      const merged = sanitizeOptimizationSettings({ ...DEFAULT_SETTINGS, ...parsed });
      const hadLegacyModel = SITE_MODEL_FIELDS.some((field) => {
        const raw = typeof parsed[field] === "string" ? parsed[field]!.trim() : "";
        return raw.length > 0 && raw !== merged[field];
      });
      if (hadLegacyModel) {
        localStorage.setItem(`${SETTINGS_STORAGE_KEY_PREFIX}${siteId}`, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (e) {
    console.error("[OptimizationSettings] Failed to parse stored settings:", e);
  }
  return DEFAULT_SETTINGS;
}

export function saveOptimizationSettings(siteId: string, settings: OptimizationSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${SETTINGS_STORAGE_KEY_PREFIX}${siteId}`, JSON.stringify(settings));
  } catch (e) {
    console.error("[OptimizationSettings] Failed to save settings:", e);
  }
}

export function getOptimizationMode(siteId: string): "quick" | "standard" | "full" {
  if (typeof window === "undefined") return "standard";
  try {
    const stored = localStorage.getItem(`${MODE_STORAGE_KEY_PREFIX}${siteId}`);
    if (stored === "quick" || stored === "standard" || stored === "full") {
      return stored;
    }
  } catch (e) {
    console.error("[OptimizationMode] Failed to parse stored mode:", e);
  }
  return "standard";
}

export function saveOptimizationMode(siteId: string, mode: "quick" | "standard" | "full"): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${MODE_STORAGE_KEY_PREFIX}${siteId}`, mode);
  } catch (e) {
    console.error("[OptimizationMode] Failed to save mode:", e);
  }
}

const GLOBAL_RESEARCH_MODEL_KEY = "global_research_model";
const DEFAULT_RESEARCH_MODEL = DEFAULT_SETTINGS.researchModel;

const SITE_MODEL_FIELDS = [
  "model",
  "researchModel",
  "metaModel",
  "reportModel",
  "adsModel",
  "imageModel",
] as const;

function sanitizeOptimizationSettings(settings: OptimizationSettings): OptimizationSettings {
  return {
    ...settings,
    model: coerceOpenRouterModelId(settings.model, DEFAULT_SETTINGS.model),
    researchModel: coerceOpenRouterModelId(settings.researchModel, DEFAULT_SETTINGS.researchModel),
    metaModel: coerceOpenRouterModelId(settings.metaModel, DEFAULT_SETTINGS.metaModel),
    reportModel: coerceOpenRouterModelId(settings.reportModel, DEFAULT_SETTINGS.reportModel),
    adsModel: coerceOpenRouterModelId(settings.adsModel, DEFAULT_SETTINGS.adsModel),
    imageModel: coerceOpenRouterModelId(settings.imageModel, DEFAULT_SETTINGS.imageModel),
  };
}

function modelFromSiteSettings(
  siteId: string | null | undefined,
  field: keyof Pick<
    OptimizationSettings,
    "researchModel" | "model" | "metaModel" | "reportModel" | "adsModel" | "imageModel"
  >,
  readGlobal: () => string,
  hardcodedDefault: string,
): string {
  if (siteId) {
    const siteSettings = getOptimizationSettings(siteId);
    const v = coerceOpenRouterModelId(siteSettings[field], hardcodedDefault);
    if (v) return v;
  }
  if (typeof window !== "undefined") {
    return readGlobal();
  }
  return hardcodedDefault;
}

export function getResearchModel(siteId?: string): string {
  if (siteId) {
    const siteSettings = getOptimizationSettings(siteId);
    if (siteSettings.researchModel) {
      return coerceOpenRouterModelId(siteSettings.researchModel, DEFAULT_SETTINGS.researchModel);
    }
    if (siteSettings.model) {
      return coerceOpenRouterModelId(siteSettings.model, DEFAULT_SETTINGS.model);
    }
  }
  if (typeof window !== "undefined") {
    return readGlobalResearchAgentModel();
  }
  return DEFAULT_RESEARCH_MODEL;
}

export function getBlogModel(siteId?: string | null): string {
  return getProductionModel(siteId);
}

export function getProductionModel(siteId?: string | null): string {
  return modelFromSiteSettings(siteId, "model", readGlobalBlogAgentModel, DEFAULT_SETTINGS.model);
}

export function getImageModel(siteId?: string | null): string {
  if (siteId) {
    const siteSettings = getOptimizationSettings(siteId);
    if (siteSettings.imageModel) {
      return coerceOpenRouterModelId(siteSettings.imageModel, DEFAULT_SETTINGS.imageModel);
    }
  }
  if (typeof window !== "undefined") {
    return readGlobalImageAgentModel();
  }
  return DEFAULT_IMAGE_MODEL;
}

export function getMetaModel(siteId?: string | null): string {
  return modelFromSiteSettings(siteId, "metaModel", readGlobalMetaAgentModel, DEFAULT_SETTINGS.metaModel);
}

export function getReportModel(siteId?: string | null): string {
  return modelFromSiteSettings(siteId, "reportModel", readGlobalReportAgentModel, DEFAULT_SETTINGS.reportModel);
}

export function getAdsModel(siteId?: string | null): string {
  return modelFromSiteSettings(siteId, "adsModel", readGlobalAdsAgentModel, DEFAULT_SETTINGS.adsModel);
}

export function setGlobalResearchModel(model: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GLOBAL_RESEARCH_MODEL_KEY, model);
  } catch (e) {
    console.error("[ResearchModel] Failed to save global model:", e);
  }
}

export type { OptimizationSettings } from "@/lib/optimization-settings-defaults";
export { DEFAULT_SETTINGS } from "@/lib/optimization-settings-defaults";
