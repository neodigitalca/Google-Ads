import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, mergeProcessEnv, requireEnv as requireEnvShared } from "../_shared/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..", "..", "..");
export const envPath = path.join(repoRoot, ".env.chatgpt-audit");
export const sessionPath = path.join(repoRoot, ".chatgpt-audit-session.json");
export const defaultAgentMailInbox = "neo-pulse@agentmail.to";

export function loadEnv(filePath = envPath) {
  return loadEnvFile(filePath);
}

function loadOpenRouterFromAppSecretsPhp() {
  const secretsPath = path.join(
    repoRoot,
    "wordpress-plugins",
    "neo-pulse-app",
    "includes",
    "neo-pulse-app-secrets.php",
  );
  if (!fs.existsSync(secretsPath)) return "";
  const src = fs.readFileSync(secretsPath, "utf8");
  const match = src.match(
    /define\(\s*'NEO_PULSE_APP_OPENROUTER_API_KEY',\s*'((?:\\'|[^'])*)'/,
  );
  if (!match) return "";
  return match[1].replace(/\\'/g, "'").trim();
}

export function resolveEnv(overrides = {}) {
  const rootEnvPath = path.join(repoRoot, ".env");
  const envFileOverride = process.env.CHATGPT_AUDIT_ENV_FILE?.trim();
  const env = {
    ...loadEnv(rootEnvPath),
    ...loadEnv(envPath),
    ...(envFileOverride ? loadEnv(envFileOverride) : {}),
  };
  const merged = mergeProcessEnv(env);
  const openRouterFromSecrets = loadOpenRouterFromAppSecretsPhp();
  if (openRouterFromSecrets) {
    if (!merged.OPENROUTER_API_KEY) merged.OPENROUTER_API_KEY = openRouterFromSecrets;
    if (!merged.NEO_PULSE_APP_OPENROUTER_API_KEY) {
      merged.NEO_PULSE_APP_OPENROUTER_API_KEY = openRouterFromSecrets;
    }
  }
  return { ...merged, ...overrides };
}

export function requireEnv(name, env) {
  return requireEnvShared(
    name,
    env,
    "Set it in .env.chatgpt-audit or the environment.",
  );
}
