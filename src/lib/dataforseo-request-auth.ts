import { readDataForSeoApiKeyForRequests } from "@/lib/integration-api-keys-runtime";

export function readDataForSeoApiKeyFromSettings(): string {
  return readDataForSeoApiKeyForRequests();
}


/** Attach Dashboard DataForSEO key to MCP / DataForSEO API requests (server reads header or body). */
export function withDataForSeoRequestAuth(params: unknown): Record<string, unknown> {
  const base =
    params !== null && typeof params === "object" && !Array.isArray(params)
      ? { ...(params as Record<string, unknown>) }
      : {};
  const key = readDataForSeoApiKeyFromSettings();
  if (key) {
    base.dataForSeoApiKey = key;
  }
  return base;
}

export function dataForSeoRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra ?? {}),
  };
  const key = readDataForSeoApiKeyFromSettings();
  if (key) {
    headers["X-DataForSEO-Api-Key"] = key;
  }
  return headers;
}
