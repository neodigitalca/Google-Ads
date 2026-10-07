import {
  getAdsModel,
  getImageModel,
  getMetaModel,
  getProductionModel,
  getReportModel,
  getResearchModel,
} from "@/lib/optimization-settings-storage";

/** Run-scoped OpenRouter model ids (resolved once per pipeline). */
export type AgentModelBundle = {
  research: string;
  blog: string;
  meta: string;
  report: string;
  ads: string;
  image: string;
};

export function resolveAgentModelsForSite(siteId?: string | null): AgentModelBundle {
  return {
    research: getResearchModel(siteId ?? undefined),
    blog: getProductionModel(siteId),
    meta: getMetaModel(siteId),
    report: getReportModel(siteId),
    ads: getAdsModel(siteId),
    image: getImageModel(siteId),
  };
}
