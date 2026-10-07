/** OpenRouter remote model ids use `provider/model` (never bare Ollama `name:tag`). */
export function isOpenRouterRemoteModelId(modelId: string): boolean {
  const id = modelId.trim();
  if (!id.includes("/")) return false;
  if (/^[^:]+:[^/]+$/.test(id)) return false;
  return true;
}

export function coerceOpenRouterModelId(
  modelId: string | undefined | null,
  fallback: string,
): string {
  const id = modelId?.trim() ?? "";
  if (id && isOpenRouterRemoteModelId(id)) return id;
  return fallback.trim();
}
