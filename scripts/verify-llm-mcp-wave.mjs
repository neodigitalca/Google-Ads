#!/usr/bin/env node
/**
 * Smoke-test SERP + LLM MCP (same paths as bulk prompt Play).
 * Usage: node scripts/verify-llm-mcp-wave.mjs
 */
const KEYWORD =
  "A Complete Buying Guide To Hunter Douglas Top-Down Bottom-Up Shades In Canada 2026";
const BASE = process.env.NEO_PULSE_VERIFY_BASE || "http://127.0.0.1:8080";
const API_KEY = process.env.DATAFORSEO_API_PASSWORD || process.env.DATAFORSEO_API_KEY || "";

async function postMcp(tool, body, timeoutMs) {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY.trim()) headers["X-DataForSEO-Api-Key"] = API_KEY.trim();
  const res = await fetch(`${BASE}/api/mcp/${tool}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

const serpLocation = "Canada";

console.log("Base:", BASE);
console.log("Keyword:", KEYWORD.slice(0, 60) + "…");
console.log("Settings key sent:", Boolean(API_KEY.trim()));

const t0 = Date.now();
const serp = await postMcp(
  "DataForSEO_serp_organic_live_advanced",
  {
    keyword: KEYWORD,
    location_name: serpLocation,
    language_code: "en",
    depth: 5,
    people_also_ask_click_depth: 2,
  },
  120_000,
);
console.log(`SERP HTTP ${serp.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s`, {
  status_code: serp.json?.status_code,
  tasks: serp.json?.tasks?.length,
  error: serp.json?.error,
});

const t1 = Date.now();
const llm = await postMcp(
  "DataForSEO_llm_responses_live",
  {
    platform: "chat_gpt",
    model_name: "o4-mini",
    user_prompt: `What should a buyer know about Hunter Douglas top-down bottom-up shades in Canada? Keyword: ${KEYWORD}`,
    web_search: true,
    web_search_country_iso_code: "CA",
  },
  180_000,
);
console.log(`LLM HTTP ${llm.status} in ${((Date.now() - t1) / 1000).toFixed(1)}s`, {
  status_code: llm.json?.status_code,
  task_status: llm.json?.tasks?.[0]?.status_code,
  error: llm.json?.error,
});

if (serp.status !== 200 || llm.status !== 200) {
  process.exit(1);
}
if (llm.json?.tasks?.[0]?.status_code !== 20000 && llm.json?.status_code !== 20000) {
  console.error("LLM task failed:", llm.json?.tasks?.[0]?.status_message || llm.json?.status_message);
  process.exit(1);
}
console.log("OK — SERP + LLM MCP paths work.");
