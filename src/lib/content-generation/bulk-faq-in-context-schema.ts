import type { OpenRouterAppResponseFormat } from "@/lib/openrouter-app-api";

export function bulkFaqPairsResponseFormat(pairCount: number): OpenRouterAppResponseFormat {
  const n = Math.min(8, Math.max(1, Math.floor(pairCount) || 4));
  return {
    type: "json_schema",
    json_schema: {
      name: "bulk_faq_pairs",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["pairs"],
        properties: {
          pairs: {
            type: "array",
            minItems: n,
            maxItems: n,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["question", "answer"],
              properties: {
                question: { type: "string", minLength: 1 },
                answer: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  };
}

export type BulkFaqPairsPayload = {
  pairs?: Array<{ question?: unknown; answer?: unknown }>;
};
