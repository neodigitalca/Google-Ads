const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const LOCAL_CONFIG_PATH = path.join(REPO_ROOT, "scripts", "local-wp-staging.config.json");
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
  try {
    const host = new URL(target).hostname.toLowerCase();
    return host.endsWith(".local") || host === "localhost" || host.startsWith("127.");
  } catch {
    return false;
  }
}

/** Local Vite dev only: neopulse.local from config or exit. */
function requireLocalDevApiTarget() {
  const target = readLocalConfigTarget();
  if (!target) {
    console.error("Missing or invalid scripts/local-wp-staging.config.json");
    console.error("One-time: npm run setup:local-wp");
    process.exit(1);
  }
  if (!isLocalWpProxyTarget(target)) {
    console.error("local-wp-staging.config.json apiProxyTarget must be a .local WordPress URL.");
    process.exit(1);
  }
  return target;
}

function resolveDevApiTarget() {
  const local = readLocalConfigTarget();
  if (local && isLocalWpProxyTarget(local)) {
    return local;
  }
  return PRODUCTION_API_TARGET;
}

module.exports = {
  PRODUCTION_API_TARGET,
  requireLocalDevApiTarget,
  resolveDevApiTarget,
  isLocalWpProxyTarget,
};
