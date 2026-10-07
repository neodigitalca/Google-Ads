import { loadDataForSEOApiKey } from "@/lib/api";

let runtimeDataForSeoApiKey = "";

/** Bulk Play: DataForSEO key for MCP requests (OpenRouter uses getOpenRouterApiKeyForApp). */
export function setRuntimeDataForSeoApiKey(key: string): void {
  runtimeDataForSeoApiKey = key.trim();
}

export function readDataForSeoApiKeyForRequests(): string {
  return runtimeDataForSeoApiKey || loadDataForSEOApiKey()?.trim() || "";
}
