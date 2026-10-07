/** GSC / Ads reporting outline: strict json_schema, one pass. */

import type { OpenRouterAppResponseFormat } from "@/lib/openrouter-app-api";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";

/** Request the model's full allowed completion budget (no artificial low cap). */
export function gscOutlineMaxOutputTokensForModel(modelId: string): number {
  return getCompetitorReportMaxOutputTokens(modelId);
}

/** Prompt guidance limits (aligned with OpenRouter schema maxLength). */
export const GSC_OUTLINE_OUTPUT_LIMITS = {
  executiveSummaryMaxChars: 4_000,
  topOpportunitiesMax: 12,
  labelMaxChars: 120,
  whyMaxChars: 400,
  metricsMaxChars: 280,
  evidenceMaxItems: 8,
  evidenceMaxChars: 450,
} as const;

const L = GSC_OUTLINE_OUTPUT_LIMITS;

/** OpenRouter strict JSON schema for outline synthesis (executiveSummary + topOpportunities only). */
export const GSC_REPORTING_OUTLINE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["executiveSummary", "topOpportunities"],
  properties: {
    executiveSummary: { type: "string", maxLength: L.executiveSummaryMaxChars },
    topOpportunities: {
      type: "array",
      maxItems: L.topOpportunitiesMax,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["rank", "label", "why", "metrics"],
        properties: {
          rank: { type: "integer" },
          label: { type: "string", maxLength: L.labelMaxChars },
          why: { type: "string", maxLength: L.whyMaxChars },
          metrics: { type: "string", maxLength: L.metricsMaxChars },
          evidence: {
            type: "array",
            maxItems: L.evidenceMaxItems,
            items: { type: "string", maxLength: L.evidenceMaxChars },
          },
        },
      },
    },
  },
};

export const GSC_OUTLINE_RESPONSE_FORMAT: OpenRouterAppResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "gsc_reporting_outline",
    strict: true,
    schema: GSC_REPORTING_OUTLINE_JSON_SCHEMA,
  },
};

export const GSC_OUTLINE_OPENROUTER_OPTS = {
  responseFormat: GSC_OUTLINE_RESPONSE_FORMAT,
  temperature: 0.15,
};
