import { getSessionToken } from "@/lib/auth-device";
import { getOpenRouterApiKeyForApp } from "@/lib/openrouter-api-key-resolve";
import { backendApiUrl } from "@/lib/wordpress-api/connection";

export type OpenRouterAppMessage = {
  role: "system" | "user" | "assistant";
  content: string | unknown[];
};

export type OpenRouterAppResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict: boolean;
        schema: Record<string, unknown>;
      };
    };

export function openRouterChatCompletionUrl(): string {
  return backendApiUrl("/openrouter/chat-completion");
}

export function openRouterModelsCatalogUrl(): string {
  return backendApiUrl("/openrouter/models");
}

export type OpenRouterModelCatalogEntry = {
  id: string;
  name: string;
  promptUsdPerToken: number | null;
  completionUsdPerToken: number | null;
  imageUsdPerToken: number | null;
  contextLength: number | null;
  textOutput: boolean;
  imageOutput: boolean;
  /** Legacy: local Ollama rows from API; stripped client-side and never used. */
  local?: boolean;
};

export async function getOpenRouterModelsCatalog(apiKey?: string): Promise<{
  models: OpenRouterModelCatalogEntry[];
  cachedAt: string;
}> {
  const response = await fetch(openRouterModelsCatalogUrl(), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: openRouterAppApiHeaders(apiKey),
  });

  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    models?: OpenRouterModelCatalogEntry[];
    cachedAt?: string;
  };

  if (!response.ok || !data.ok || !Array.isArray(data.models)) {
    throw new Error(data.error?.trim() || `OpenRouter models error (${response.status})`);
  }

  return {
    models: data.models,
    cachedAt: typeof data.cachedAt === "string" ? data.cachedAt : new Date().toISOString(),
  };
}

/** Coerce OpenRouter system/user prompt fields to trimmed strings (handles bad runtime types). */
export function openRouterPromptText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

/** Non-stream assistant text when `content` is empty (reasoning models, structured `parsed`). */
export function openRouterAssistantTextFromMessage(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as Record<string, unknown>;
  const content = msg.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed) return trimmed;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        const trimmed = text.trim();
        if (trimmed) parts.push(trimmed);
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }
  if (typeof msg.reasoning === "string") {
    const trimmed = msg.reasoning.trim();
    if (trimmed) return trimmed;
  }
  const details = msg.reasoning_details;
  if (Array.isArray(details)) {
    const parts: string[] = [];
    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue;
      const text = (detail as { text?: unknown }).text;
      if (typeof text === "string") {
        const trimmed = text.trim();
        if (trimmed) parts.push(trimmed);
      }
    }
    if (parts.length > 0) return parts.join("\n");
  }
  const parsed = msg.parsed;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return JSON.stringify(parsed);
  }
  return "";
}

export function openRouterAppApiHeaders(apiKey?: string): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = getSessionToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const key = (apiKey ?? getOpenRouterApiKeyForApp()).trim();
  if (key) headers.set("X-OpenRouter-Api-Key", key);
  return headers;
}

function messageContentNonEmpty(content: OpenRouterAppMessage["content"]): boolean {
  if (typeof content === "string") return content.trim().length > 0;
  if (Array.isArray(content)) return content.length > 0;
  return false;
}

function filterOpenRouterAppMessages(messages: OpenRouterAppMessage[] | undefined): OpenRouterAppMessage[] {
  if (!messages?.length) return [];
  return messages.filter((msg) => {
    const role = openRouterPromptText(msg.role);
    return role.length > 0 && messageContentNonEmpty(msg.content);
  });
}

/** Wire JSON for POST /openrouter/chat-completion (messages or system+user, never an empty mix). */
export function buildOpenRouterAppChatRequestBody(args: {
  apiKey?: string;
  model: string;
  messages?: OpenRouterAppMessage[];
  system?: string;
  user?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: OpenRouterAppResponseFormat;
  modalities?: string[];
  size?: string;
  tools?: unknown[];
  toolChoice?: unknown;
  webSearchOptions?: Record<string, unknown>;
}): Record<string, unknown> {
  const apiKey = (args.apiKey ?? getOpenRouterApiKeyForApp()).trim();
  const system = openRouterPromptText(args.system);
  const user = openRouterPromptText(args.user);
  const filteredMessages = filterOpenRouterAppMessages(args.messages);

  const base: Record<string, unknown> = {
    apiKey: apiKey || undefined,
    model: args.model,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
    topP: args.topP,
    stream: false,
    responseFormat: args.responseFormat,
    modalities: args.modalities,
    size: args.size,
    tools: args.tools,
    tool_choice: args.toolChoice,
    webSearchOptions: args.webSearchOptions,
  };

  if (filteredMessages.length > 0) {
    return { ...base, messages: filteredMessages };
  }
  if (system !== "" && user !== "") {
    return { ...base, system, user };
  }
  if (user !== "") {
    return { ...base, user };
  }
  if (system !== "") {
    return { ...base, system };
  }

  throw new Error("OpenRouter chat request has no message content.");
}

export async function postOpenRouterAppChat(args: {
  apiKey?: string;
  model: string;
  messages?: OpenRouterAppMessage[];
  system?: string;
  user?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: OpenRouterAppResponseFormat;
  modalities?: string[];
  size?: string;
  tools?: unknown[];
  toolChoice?: unknown;
  webSearchOptions?: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<{
  raw: unknown;
  content: string;
  finishReason?: string;
  nativeFinishReason?: string;
  parsed?: Record<string, unknown>;
}> {
  const apiKey = (args.apiKey ?? getOpenRouterApiKeyForApp()).trim();
  const requestBody = buildOpenRouterAppChatRequestBody({ ...args, apiKey });
  const response = await fetch(openRouterChatCompletionUrl(), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    signal: args.signal,
    headers: openRouterAppApiHeaders(apiKey),
    body: JSON.stringify(requestBody),
  });

  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    content?: string;
    finishReason?: string;
    nativeFinishReason?: string;
    raw?: unknown;
    parsed?: Record<string, unknown>;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error?.trim() || `OpenRouter error (${response.status})`);
  }
  const hasParsed =
    data.parsed && typeof data.parsed === "object" && !Array.isArray(data.parsed);
  if (typeof data.content !== "string") {
    if (hasParsed) {
      data.content = "";
    } else {
      const raw = data.raw && typeof data.raw === "object" ? (data.raw as Record<string, unknown>) : null;
      const choices = raw && Array.isArray(raw.choices) ? raw.choices : null;
      const message = choices && typeof choices[0] === "object" && choices[0]
        ? (choices[0] as { message?: { tool_calls?: unknown } }).message
        : undefined;
      if (!message?.tool_calls) {
        throw new Error(data.error?.trim() || `OpenRouter error (${response.status})`);
      }
      data.content = "";
    }
  }

  let parsed =
    data.parsed && typeof data.parsed === "object" && !Array.isArray(data.parsed)
      ? data.parsed
      : undefined;
  if (!parsed && data.raw && typeof data.raw === "object") {
    const raw = data.raw as Record<string, unknown>;
    const choices = Array.isArray(raw.choices) ? raw.choices : null;
    const message =
      choices && choices[0] && typeof choices[0] === "object"
        ? (choices[0] as { message?: unknown }).message
        : undefined;
    if (message && typeof message === "object" && !Array.isArray(message)) {
      const msgParsed = (message as { parsed?: unknown }).parsed;
      if (msgParsed && typeof msgParsed === "object" && !Array.isArray(msgParsed)) {
        parsed = msgParsed as Record<string, unknown>;
      }
    }
  }
  let content = typeof data.content === "string" ? data.content : "";
  if (!content.trim() && parsed) {
    content = JSON.stringify(parsed);
  }
  if (!content.trim() && data.raw) {
    const raw = data.raw as Record<string, unknown>;
    const choices = Array.isArray(raw.choices) ? raw.choices : null;
    const message =
      choices && choices[0] && typeof choices[0] === "object"
        ? (choices[0] as { message?: unknown }).message
        : undefined;
    const fromMessage = openRouterAssistantTextFromMessage(message);
    if (fromMessage.trim()) {
      content = fromMessage;
    }
  }

  return {
    raw: data.raw ?? data,
    content,
    finishReason: data.finishReason,
    nativeFinishReason: data.nativeFinishReason,
    parsed,
  };
}

/** Non-stream chat via app API; same call shape as the old OpenRouter fetch. */
export async function postOpenRouterAppChatFetch(init: RequestInit): Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<Record<string, unknown>>;
  text: () => Promise<string>;
}> {
  const parsed = JSON.parse(String(init.body ?? "{}")) as {
    apiKey?: string;
    model?: string;
    messages?: OpenRouterAppMessage[];
    system?: string;
    user?: string;
    temperature?: number;
    max_tokens?: number;
    maxTokens?: number;
    top_p?: number;
    topP?: number;
    response_format?: OpenRouterAppResponseFormat;
    responseFormat?: OpenRouterAppResponseFormat;
    modalities?: string[];
    size?: string;
    tools?: unknown[];
    tool_choice?: unknown;
    toolChoice?: unknown;
    webSearchOptions?: Record<string, unknown>;
    web_search_options?: Record<string, unknown>;
  };
  try {
    const result = await postOpenRouterAppChat({
      apiKey: parsed.apiKey?.trim() || getOpenRouterApiKeyForApp() || undefined,
      model: parsed.model ?? "",
      messages: parsed.messages,
      system: parsed.system,
      user: parsed.user,
      temperature: parsed.temperature,
      maxTokens: parsed.maxTokens ?? parsed.max_tokens,
      topP: parsed.topP ?? parsed.top_p,
      responseFormat: parsed.responseFormat ?? parsed.response_format,
      modalities: parsed.modalities,
      size: parsed.size,
      tools: parsed.tools,
      toolChoice: parsed.toolChoice ?? parsed.tool_choice,
      webSearchOptions: parsed.webSearchOptions ?? parsed.web_search_options,
      signal: init.signal ?? undefined,
    });
    const raw =
      result.raw && typeof result.raw === "object"
        ? (result.raw as Record<string, unknown>)
        : null;
    const json = raw && Array.isArray(raw.choices)
      ? raw
      : {
          choices: [
            {
              message: { content: result.content },
              finish_reason: result.finishReason,
              native_finish_reason: result.nativeFinishReason,
            },
          ],
        };
    return {
      ok: true,
      status: 200,
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const json = { error: { message } };
    return {
      ok: false,
      status: 500,
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  }
}

