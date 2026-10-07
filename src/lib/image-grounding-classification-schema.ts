import type { OpenRouterAppResponseFormat } from "@/lib/openrouter-app-api";

/** Keep in sync with IMAGE_REF_MAX_TARGETS in image-reference-research.ts */
const MAX_GROUNDING_TARGETS = 3;

/** Featured / Solo Google Images evidence plan (needs array). */
export const IMAGE_EVIDENCE_PLAN_RESPONSE_FORMAT: OpenRouterAppResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "image_evidence_plan",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "needs"],
      properties: {
        mode: { type: "string", enum: ["abstract", "grounded"] },
        needs: {
          type: "array",
          maxItems: MAX_GROUNDING_TARGETS,
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "kind",
              "layer",
              "query",
              "role",
              "location_name",
              "acceptanceBrief",
              "pickCount",
            ],
            properties: {
              kind: { type: "string", enum: ["place", "product", "howto", "other"] },
              layer: { type: "string", enum: ["foreground", "midground", "background"] },
              query: { type: "string", minLength: 1 },
              role: { type: "string", minLength: 1 },
              location_name: {
                type: "string",
                enum: ["Canada", "United States", "United Kingdom", "Australia"],
              },
              acceptanceBrief: { type: "string", minLength: 1 },
              pickCount: { type: "integer", minimum: 1, maximum: 3 },
            },
          },
        },
      },
    },
  },
};

export const IMAGE_GROUNDING_CLASSIFICATION_RESPONSE_FORMAT: OpenRouterAppResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "image_grounding_classification",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "targets"],
      properties: {
        mode: { type: "string", enum: ["abstract", "grounded"] },
        targets: {
          type: "array",
          maxItems: MAX_GROUNDING_TARGETS,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "layer", "query", "role", "location_name"],
            properties: {
              kind: { type: "string", enum: ["place", "product", "howto", "other"] },
              layer: { type: "string", enum: ["foreground", "midground", "background"] },
              query: { type: "string", minLength: 1 },
              role: { type: "string", minLength: 1 },
              location_name: {
                type: "string",
                enum: ["Canada", "United States", "United Kingdom", "Australia"],
              },
            },
          },
        },
      },
    },
  },
};
