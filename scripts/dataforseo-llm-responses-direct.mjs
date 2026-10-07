import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export const LLM_RESPONSES_LIVE_PATH = "/api/dataforseo/llm-responses-live";

export const PLATFORM_PATHS = {
  chat_gpt: "ai_optimization/chat_gpt/llm_responses/live",
  gemini: "ai_optimization/gemini/llm_responses/live",
  perplexity: "ai_optimization/perplexity/llm_responses/live",
};

export function normalizeApiPath(url) {
  const path = (url ?? "").split("?")[0] ?? "";
  return path.replace(/\/+$/, "") || "/";
}

export function isLlmResponsesLiveRequest(method, url) {
  return method === "POST" && normalizeApiPath(url) === LLM_RESPONSES_LIVE_PATH;
}

function loadDotEnv() {
  const out = {};
  for (const file of [".env", ".env.local", ".env.development"]) {
    try {
      for (const line of readFileSync(join(root, file), "utf8").split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq < 1) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!(k in out)) out[k] = v;
      }
    } catch {
      /* ignore missing file */
    }
  }
  return out;
}

function pickTask(body) {
  const task = {
    model_name: String(body.model_name ?? "").trim(),
    user_prompt: String(body.user_prompt ?? "").trim(),
  };
  for (const f of ["system_message", "web_search_country_iso_code", "web_search_city"]) {
    if (typeof body[f] === "string" && body[f].trim()) task[f] = body[f].trim();
  }
  if (body.web_search != null) task.web_search = Boolean(body.web_search);
  if (body.force_web_search != null) task.force_web_search = Boolean(body.force_web_search);
  if (Array.isArray(body.message_chain)) {
    const chain = [];
    for (const entry of body.message_chain) {
      if (!entry || entry.role !== "user") continue;
      const message = String(entry.message ?? "").trim();
      if (!message) continue;
      chain.push({ role: "user", message });
      if (chain.length >= 10) break;
    }
    if (chain.length) task.message_chain = chain;
  }
  return task;
}

function readSecretsPhpLogin() {
  try {
    const src = readFileSync(
      join(root, "wordpress-plugins/neo-pulse-app/includes/neo-pulse-app-secrets.php"),
      "utf8",
    );
    return src.match(/NEO_PULSE_APP_DATAFORSEO_LOGIN',\s*'([^']*)'/)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

export function resolveDataForSeoLoginFromEnv() {
  const env = loadDotEnv();
  return (
    env.DATAFORSEO_API_LOGIN ||
    env.DATAFORSEO_LOGIN ||
    env.NEO_PULSE_APP_DATAFORSEO_LOGIN ||
    readSecretsPhpLogin() ||
    ""
  ).trim();
}

/** Settings API password + DATAFORSEO_API_LOGIN in .env (optional login:password in Settings). */
export function authBase64FromSettingsApiKey(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const colon = trimmed.indexOf(":");
  if (colon > 0) {
    const login = trimmed.slice(0, colon).trim();
    const password = trimmed.slice(colon + 1).trim();
    if (login && password) {
      return Buffer.from(`${login}:${password}`).toString("base64");
    }
  }
  const login = resolveDataForSeoLoginFromEnv();
  if (!login) return null;
  return Buffer.from(`${login}:${trimmed}`).toString("base64");
}

/** @param {import('node:http').IncomingMessage} req */
export function resolveDataForSeoAuthFromRequest(req, bodyJson) {
  const headerRaw = req.headers["x-dataforseo-api-key"];
  const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
  const fromHeader = authBase64FromSettingsApiKey(header ?? "");
  if (fromHeader) return fromHeader;
  const bodyKey =
    bodyJson && typeof bodyJson.dataForSeoApiKey === "string" ? bodyJson.dataForSeoApiKey : "";
  return authBase64FromSettingsApiKey(bodyKey);
}

export function dataForSeoAuthConfigError(req, bodyJson) {
  const headerRaw = req.headers["x-dataforseo-api-key"];
  const header = (Array.isArray(headerRaw) ? headerRaw[0] : headerRaw) ?? "";
  const bodyKey =
    bodyJson && typeof bodyJson.dataForSeoApiKey === "string" ? bodyJson.dataForSeoApiKey : "";
  const key = String(header || bodyKey).trim();
  if (!key) {
    return { error: "DataForSEO API key required", hint: "Save your API password in Dashboard → Settings → DataForSEO." };
  }
  if (!resolveDataForSeoLoginFromEnv()) {
    return {
      error: "DataForSEO account login missing",
      hint: "Set DATAFORSEO_API_LOGIN in the repo .env (account email). Settings holds the API password only.",
    };
  }
  return { error: "DataForSEO auth failed", hint: "Check Settings API password and DATAFORSEO_API_LOGIN in .env." };
}

/** CLI / check scripts only (.env login + password). */
export function loadDataForSeoAuth() {
  const env = loadDotEnv();
  const login =
    env.DATAFORSEO_API_LOGIN || env.DATAFORSEO_LOGIN || env.NEO_PULSE_APP_DATAFORSEO_LOGIN || "";
  const pass =
    env.DATAFORSEO_API_PASSWORD ||
    env.DATAFORSEO_PASSWORD ||
    env.NEO_PULSE_APP_DATAFORSEO_PASSWORD ||
    "";
  if (!login || !pass) return null;
  return Buffer.from(`${login}:${pass}`).toString("base64");
}

/** Handle POST /api/dataforseo/llm-responses-live via DataForSEO (never proxy to WP). */
export async function handleDataForSeoLlmResponsesLive(rawBody, auth) {
  const body = rawBody?.length ? JSON.parse(rawBody.toString("utf8")) : {};
  const platform = String(body.platform ?? "").trim();
  const endpoint = PLATFORM_PATHS[platform];
  if (!endpoint) {
    return { status: 400, json: { error: "Invalid platform" } };
  }
  if (!body.model_name || !body.user_prompt) {
    return { status: 400, json: { error: "model_name and user_prompt are required" } };
  }

  const task = pickTask(body);
  const dfsRes = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([task]),
  });
  const dfsJson = await dfsRes.json().catch(() => ({}));
  return { status: dfsRes.ok ? 200 : dfsRes.status, json: dfsJson };
}
