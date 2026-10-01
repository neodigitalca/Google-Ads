const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const LOCAL_CONFIG_PATH = path.join(REPO_ROOT, "scripts", "local-wp-staging.config.json");
const LOCAL_CONFIG_EXAMPLE_PATH = path.join(REPO_ROOT, "scripts", "local-wp-staging.config.example.json");

/** Production API host (deploy only — not used for Vite dev proxy). */
const PRODUCTION_API_TARGET = "https://neodigital.ca";

function readLocalConfigTarget() {
  if (!fs.existsSync(LOCAL_CONFIG_PATH)) {
    return null;
  }
  try {
    const config = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, "utf8"));
    const target = String(config.apiProxyTarget || config.siteUrl || "").trim();
    return target || null;
  } catch {
    return null;
  }
}

function isLocalWpProxyTarget(target) {
  if (!target) return false;
  try {
    const host = new URL(target).hostname.toLowerCase();
    return host.endsWith(".local") || host === "localhost" || host.startsWith("127.");
  } catch {
    return false;
  }
}

/** Copy example config if missing (same as setup-local-wp). */
function ensureLocalConfig() {
  if (fs.existsSync(LOCAL_CONFIG_PATH)) {
    return true;
  }
  if (!fs.existsSync(LOCAL_CONFIG_EXAMPLE_PATH)) {
    return false;
  }
  fs.copyFileSync(LOCAL_CONFIG_EXAMPLE_PATH, LOCAL_CONFIG_PATH);
  console.log("[dev] Created scripts/local-wp-staging.config.json from example.");
  return true;
}

function resolveDevApiTargetFromEnvOrConfig() {
  const fromEnv = String(process.env.VITE_LOCAL_API_TARGET || "").trim();
  if (fromEnv && isLocalWpProxyTarget(fromEnv)) {
    return fromEnv;
  }
  const fromConfig = readLocalConfigTarget();
  if (fromConfig && isLocalWpProxyTarget(fromConfig)) {
    return fromConfig;
  }
  return null;
}

/** Local Vite dev only: neopulse.local from config or exit. */
function requireLocalDevApiTarget() {
  ensureLocalConfig();
  const target = resolveDevApiTargetFromEnvOrConfig();
  if (!target) {
    console.error("Missing or invalid scripts/local-wp-staging.config.json");
    console.error("One-time: npm run setup:local-wp");
    console.error("Or run start-neopulse-local.bat from this repo (b:\\Neo Pulse\\pulse).");
    process.exit(1);
  }
  return target;
}

/**
 * Dev server API target — local WordPress only (never production).
 * @param {{ strict?: boolean }} [options]
 */
function resolveDevApiTarget(options = {}) {
  const { strict = false } = options;
  ensureLocalConfig();
  const target = resolveDevApiTargetFromEnvOrConfig();
  if (target) {
    return target;
  }
  if (strict) {
    throw new Error(
      "Local dev requires scripts/local-wp-staging.config.json pointing at neopulse.local. " +
        "Run npm run setup:local-wp or start-neopulse-local.bat.",
    );
  }
  return null;
}

module.exports = {
  PRODUCTION_API_TARGET,
  REPO_ROOT,
  ensureLocalConfig,
  requireLocalDevApiTarget,
  resolveDevApiTarget,
  isLocalWpProxyTarget,
};
