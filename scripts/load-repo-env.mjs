/**
 * Load repo-root .env.local then .env into process.env (does not override existing).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseLine(line) {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const eq = t.indexOf("=");
  if (eq <= 0) return null;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1).replace(/\\"/g, '"');
  }
  return { key, val };
}

export function loadRepoEnv(root = REPO_ROOT) {
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const parsed = parseLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.val;
      }
    }
  }
}

export function githubPushToken() {
  return (
    process.env.GH_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.NEO_GITHUB_PAT ||
    process.env.REFACTOR_AUDIT_GH_TOKEN ||
    ""
  );
}

export function githubAuthUsername() {
  return (
    process.env.NEO_GITHUB_USERNAME ||
    process.env.NEO_MASTER_GITHUB_USERNAME ||
    "x-access-token"
  );
}

/** HTTPS remote URL with embedded token for non-interactive git push. */
export function withGitHubTokenRemote(remoteUrl, token, username) {
  if (!token?.trim()) return remoteUrl;
  const u = encodeURIComponent(username || "x-access-token");
  const t = encodeURIComponent(token.trim());
  if (remoteUrl.startsWith("https://github.com/")) {
    return remoteUrl.replace("https://", `https://${u}:${t}@`);
  }
  if (remoteUrl.startsWith("https://")) {
    return remoteUrl.replace("https://", `https://${u}:${t}@`);
  }
  return remoteUrl;
}
