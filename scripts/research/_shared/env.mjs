import fs from "node:fs";

/**
 * @param {string} filePath
 * @returns {Record<string, string>}
 */
export function loadEnvFile(filePath) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * @param {Record<string, string>} env
 * @returns {Record<string, string>}
 */
export function mergeProcessEnv(env) {
  const merged = { ...env };
  for (const [key, value] of Object.entries(process.env)) {
    if (value && !(key in merged)) merged[key] = value;
  }
  return merged;
}

/**
 * @param {string} name
 * @param {Record<string, string>} env
 * @param {string} missingHint
 */
export function requireEnv(name, env, missingHint) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. ${missingHint}`);
  }
  return value;
}
