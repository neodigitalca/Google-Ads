#!/usr/bin/env node
/**
 * Run bundle-automation-recipes-catalog.mjs only when recipes are newer than the bundle (or bundle missing).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const recipesDir = path.join(repoRoot, "wordpress-plugins/neo-pulse-app/recipes");
const bundlePath = path.join(repoRoot, "src/lib/automation-recipes-catalog.bundle.json");
const bundleScript = path.join(__dirname, "bundle-automation-recipes-catalog.mjs");

function latestRecipeMtimeMs() {
  if (!fs.existsSync(recipesDir)) {
    return 0;
  }
  let latest = 0;
  for (const name of fs.readdirSync(recipesDir)) {
    if (!name.endsWith(".json")) continue;
    const stat = fs.statSync(path.join(recipesDir, name));
    if (stat.mtimeMs > latest) latest = stat.mtimeMs;
  }
  return latest;
}

function bundleMtimeMs() {
  if (!fs.existsSync(bundlePath)) return 0;
  return fs.statSync(bundlePath).mtimeMs;
}

function ensureAutomationRecipesCatalog() {
  const recipeLatest = latestRecipeMtimeMs();
  const bundleAt = bundleMtimeMs();
  if (bundleAt > 0 && recipeLatest <= bundleAt) {
    console.log("[dev] Automation recipes catalog up to date, skip bundle.");
    return 0;
  }

  const result = spawnSync(process.execPath, [bundleScript], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

module.exports = { ensureAutomationRecipesCatalog };

if (require.main === module) {
  process.exit(ensureAutomationRecipesCatalog());
}
