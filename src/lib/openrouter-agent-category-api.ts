import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import {
  getAdsModel,
  getBlogModel,
  getImageModel,
  getMetaModel,
  getReportModel,
  getResearchModel,
} from "@/lib/optimization-settings-storage";
import {
  postOpenRouterAppChat,
  type OpenRouterAppMessage,
  type OpenRouterAppResponseFormat,
} from "@/lib/openrouter-app-api";

export type AgentOpenRouterCategory =
  | "research"
  | "blog"
  | "image"
  | "meta"
  | "report"
  | "ads";

export function resolveModelForAgentCategory(
  category: AgentOpenRouterCategory,
  siteId?: string | null,
): string {
  switch (category) {
    case "research":
      return getResearchModel(siteId ?? undefined);
    case "blog":
      return getBlogModel(siteId);
    case "image":
      return getImageModel(siteId);
    case "meta":
      return getMetaModel(siteId);
    case "report":
      return getReportModel(siteId);
    case "ads":
      return getAdsModel(siteId);
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export async function callAgentCategoryOpenRouterChat(args: {
  category: AgentOpenRouterCategory;
  siteId?: string | null;
  apiKey: string;
  system?: string;
  user?: string;
  messages?: OpenRouterAppMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: OpenRouterAppResponseFormat;
  signal?: AbortSignal;
}): Promise<{
  raw: unknown;
  content: string;
  finishReason?: string;
  nativeFinishReason?: string;
}> {
  const model = resolveModelForAgentCategory(args.category, args.siteId);
  const apiKey = args.apiKey.trim();

  if (args.messages?.length) {
    return postOpenRouterAppChat({
      apiKey,
      model,
      messages: args.messages,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      responseFormat: args.responseFormat,
      signal: args.signal,
    });
  }

  if (!args.system?.trim() || args.user === undefined) {
    throw new Error("OpenRouter agent call requires system and user, or messages.");
  }

  return callOpenRouterChatCompletion({
    apiKey,
    model,
    system: args.system,
    user: args.user,
    maxTokens: args.maxTokens ?? 4096,
    temperature: args.temperature,
    responseFormat: args.responseFormat,
    signal: args.signal,
  });
}
