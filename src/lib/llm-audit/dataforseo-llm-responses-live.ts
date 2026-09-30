import { backendApiUrl } from "@/lib/wordpress-api/connection";
import type { LlmAuditPlatform } from "@/lib/llm-audit/llm-audit-dataforseo";

export type DataForSeoLlmResponsesLiveParams = {
  platform: LlmAuditPlatform;
  model_name: string;
  user_prompt: string;
  system_message?: string;
  message_chain?: Array<{ role: "user"; message: string }>;
  web_search?: boolean;
  force_web_search?: boolean;
  web_search_country_iso_code?: string;
  web_search_city?: string;
  max_output_tokens?: number;
};

export const DFS_LLM_PAYMENT_SKIP = { skipped: true as const, reason: "dfs_payment" as const };

/** Backend/gateway down or DataForSEO LLM route unavailable — continue bulk without blocking. */
export const DFS_LLM_UNAVAILABLE_SKIP = { skipped: true as const, reason: "dfs_unavailable" as const };

let dfsPaymentLatched = false;

export function isDfsPaymentLatched(): boolean {
  return dfsPaymentLatched;
}

export function markDfsPaymentFailed(): void {
  dfsPaymentLatched = true;
}

export function resetDfsPaymentLatch(): void {
  dfsPaymentLatched = false;
}

export function isDfsLlmPaymentSkip(json: unknown): json is typeof DFS_LLM_PAYMENT_SKIP {
  return Boolean(
    json
    && typeof json === "object"
    && (json as { skipped?: boolean; reason?: string }).skipped === true
    && (json as { reason?: string }).reason === "dfs_payment",
  );
}

export function isDfsLlmUnavailableSkip(json: unknown): json is typeof DFS_LLM_UNAVAILABLE_SKIP {
  return Boolean(
    json
    && typeof json === "object"
    && (json as { skipped?: boolean; reason?: string }).skipped === true
    && (json as { reason?: string }).reason === "dfs_unavailable",
  );
}

export function isDfsLlmSkipped(json: unknown): boolean {
  return isDfsLlmPaymentSkip(json) || isDfsLlmUnavailableSkip(json);
}

function isGatewayHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 524;
}

export function isDataForSeoPaymentFailure(input: {
  httpStatus?: number;
  json?: unknown;
  message?: string;
}): boolean {
  if (input.httpStatus === 402) return true;
  const json = input.json && typeof input.json === "object" ? (input.json as Record<string, unknown>) : null;
  const code = typeof json?.status_code === "number" ? json.status_code : 0;
  if (code === 40200 || code === 40210) return true;
  const task = Array.isArray(json?.tasks) ? (json.tasks[0] as Record<string, unknown> | undefined) : undefined;
  const taskCode = typeof task?.status_code === "number" ? task.status_code : 0;
  if (taskCode === 40200 || taskCode === 40210) return true;
  const msg = [
    input.message,
    typeof json?.status_message === "string" ? json.status_message : "",
    typeof json?.error === "string" ? json.error : "",
    typeof task?.status_message === "string" ? task.status_message : "",
  ]
    .join(" ")
    .toLowerCase();
  return (
    msg.includes("http 402")
    || msg.includes("payment required")
    || msg.includes("insufficient funds")
  );
}

function parseJsonOrThrowHtml(text: string, status: number): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error(
      `LLM audit API returned HTML instead of JSON (HTTP ${status}). Restart dev server so /api/dataforseo/llm-responses-live hits DataForSEO directly.`,
    );
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`LLM audit API returned non-JSON (HTTP ${status})`);
  }
}

/** Direct DataForSEO LLM Responses Live via backend (not MCP tool registry). */
export async function dataforseoLlmResponsesLive(
  params: DataForSeoLlmResponsesLiveParams,
): Promise<unknown> {
  if (dfsPaymentLatched) return DFS_LLM_PAYMENT_SKIP;

  let res: Response;
  try {
    res = await fetch(backendApiUrl("/dataforseo/llm-responses-live"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn("[DFS LLM] llm-responses-live fetch failed; continuing without ChatGPT facts:", err);
    return DFS_LLM_UNAVAILABLE_SKIP;
  }

  const text = await res.text();
  if (isGatewayHttpStatus(res.status)) {
    console.warn(`[DFS LLM] llm-responses-live HTTP ${res.status}; continuing without ChatGPT facts`);
    return DFS_LLM_UNAVAILABLE_SKIP;
  }

  let json: unknown;
  try {
    json = parseJsonOrThrowHtml(text, res.status);
  } catch (err) {
    if (isGatewayHttpStatus(res.status) || !res.ok) {
      console.warn("[DFS LLM] llm-responses-live non-JSON error body; continuing without ChatGPT facts:", err);
      return DFS_LLM_UNAVAILABLE_SKIP;
    }
    throw err;
  }

  if (isDataForSeoPaymentFailure({ httpStatus: res.status, json })) {
    markDfsPaymentFailed();
    return DFS_LLM_PAYMENT_SKIP;
  }

  if (!res.ok) {
    if (isGatewayHttpStatus(res.status)) {
      return DFS_LLM_UNAVAILABLE_SKIP;
    }
    const msg =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : `HTTP ${res.status}`;
    console.warn(`[DFS LLM] llm-responses-live error; continuing without ChatGPT facts: ${msg}`);
    return DFS_LLM_UNAVAILABLE_SKIP;
  }

  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim() && !Array.isArray(obj.tasks)) {
      throw new Error(obj.error.trim());
    }
  }

  return json;
}
