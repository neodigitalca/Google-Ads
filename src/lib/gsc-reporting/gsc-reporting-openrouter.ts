import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  openRouterPromptText,
  postOpenRouterAppChat,
  type OpenRouterAppResponseFormat,
} from "@/lib/openrouter-app-api";

/** GSC reporting LLM calls use the shared OpenRouter proxy (schema-aware), not a separate GSC route. */
export async function callGscReportingOpenRouterChatCompletion(args: {
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  signal?: AbortSignal;
  temperature?: number;
  responseFormat?: OpenRouterAppResponseFormat;
}): Promise<{
  raw: unknown;
  content: string;
  finishReason?: string;
  nativeFinishReason?: string;
  parsed?: Record<string, unknown>;
}> {
  const system = openRouterPromptText(args.system);
  const user = openRouterPromptText(args.user);
  if (!system || !user) {
    throw new Error("GSC reporting OpenRouter call missing system or user prompt text.");
  }
  return postOpenRouterAppChat({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    maxTokens: args.maxTokens,
    signal: args.signal,
    temperature: args.temperature ?? REPORT_TEMPERATURE,
    responseFormat: args.responseFormat,
  });
}
