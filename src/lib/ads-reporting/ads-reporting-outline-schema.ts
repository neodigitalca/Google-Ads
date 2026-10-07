import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";

export function adsOutlineMaxOutputTokensForModel(modelId: string): number {
  return getCompetitorReportMaxOutputTokens(modelId);
}

export const ADS_OUTLINE_OUTPUT_LIMITS = {
  executiveSummaryMaxChars: 4_000,
  topOpportunitiesMax: 12,
  labelMaxChars: 120,
  whyMaxChars: 400,
  metricsMaxChars: 280,
  evidenceMaxItems: 8,
  evidenceMaxChars: 450,
} as const;

export const ADS_REPORTING_OUTLINE_JSON_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string", maxLength: ADS_OUTLINE_OUTPUT_LIMITS.executiveSummaryMaxChars },
    topOpportunities: {
      type: "array",
      maxItems: ADS_OUTLINE_OUTPUT_LIMITS.topOpportunitiesMax,
    },
  },
} as const;

export const ADS_OUTLINE_OPENROUTER_OPTS = {
  responseFormat: { type: "json_object" as const },
  temperature: 0.15,
};
