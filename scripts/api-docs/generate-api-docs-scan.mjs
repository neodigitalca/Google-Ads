import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HANDLER_PREFIX, SECTION_LABELS } from "./constants.mjs";
import { buildManifest } from "./manifest.mjs";
import { fileSlug, slugFromPath, titleFromPath, titleFromSegment } from "./path-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PLUGIN = path.join(ROOT, "wordpress-plugins/neo-pulse-app/includes");
const DOCS = path.join(ROOT, "docs/api");
const OVERRIDES = path.join(DOCS, "_overrides");


/** @type {Array<{method:string,path:string,auth:string,title?:string,stream?:boolean}>} */
const routes = [];

/** @type {Map<string, { rel: string, fn: string }>} */
const routeHandlerMap = new Map();

/** @type {Map<string, string>} */
const handlerFileContents = new Map();

function addRoute(method, apiPath, auth = "open", extra = {}) {
  const key = `${method} ${apiPath}`;
  if (routes.some((r) => `${r.method} ${r.path}` === key)) return;
  routes.push({ method, path: apiPath, auth, ...extra });
}

function parseExactRoutes(content, prefix, subVar = "subpath", handlerRel = "") {
  const re = new RegExp(
    `\\$${subVar}\\s*===\\s*'([^']+)'\\s*&&\\s*\\$method\\s*===\\s*'([^']+)'`,
    "g",
  );
  let m;
  while ((m = re.exec(content)) !== null) {
    const sub = m[1];
    const method = m[2];
    const p = sub === "" ? prefix : `${prefix}/${sub}`;
    addRoute(method, p, authForPath(p));
    const tail = content.slice(m.index, m.index + 400);
    const fnMatch = tail.match(/self::([a-z_]+)\s*\(/);
    if (fnMatch && handlerRel) {
      routeHandlerMap.set(`${method} ${p}`, { rel: handlerRel, fn: fnMatch[1] });
    }
  }
}

function parsePregRoutes(content, prefix, subVar = "subpath", handlerRel = "") {
  const re = new RegExp(
    `preg_match\\(\\s*'#\\^([^#]+)\\$#'[^)]*\\$${subVar}[^)]*\\)\\s*(?:&&\\s*\\$method\\s*===\\s*'([^']+)')?`,
    "g",
  );
  let m;
  while ((m = re.exec(content)) !== null) {
    let pattern = m[1];
    const method = m[2] ?? "ANY";
    pattern = pattern
      .replace(/\\d\+/g, "{id}")
      .replace(/\(\[a-zA-Z0-9._-\]\+\)/g, "{filename}")
      .replace(/\(\[a-zA-Z0-9_-\]\+\)/g, "{filename}");
    const p = `${prefix}/${pattern}`.replace(/\/+/g, "/");
    if (method === "ANY") {
      for (const meth of ["GET", "POST", "PATCH", "DELETE"]) {
        if (content.includes(`$method === '${meth}'`) && content.includes(pattern)) {
          addRoute(meth, p, authForPath(p));
        }
      }
      addRoute("GET", p, authForPath(p));
      addRoute("POST", p, authForPath(p));
      addRoute("PATCH", p, authForPath(p));
      addRoute("DELETE", p, authForPath(p));
    } else {
      addRoute(method, p, authForPath(p));
      const tail = content.slice(m.index, m.index + 400);
      const fnMatch = tail.match(/self::([a-z_]+)\s*\(/);
      if (fnMatch && handlerRel) {
        routeHandlerMap.set(`${method} ${p}`, { rel: handlerRel, fn: fnMatch[1] });
      }
    }
  }
}

function authForPath(apiPath) {
  if (
    apiPath === "auth/login" ||
    apiPath === "auth/register" ||
    apiPath === "auth/bootstrap" ||
    apiPath === "auth/setup-admin" ||
    apiPath === "teams/invites/accept"
  ) {
    return "public";
  }
  if (apiPath.startsWith("auth/")) return "session";
  if (apiPath.includes("/chat/")) return "team-rbac-communication";
  if (apiPath.startsWith("teams/")) return "session-team";
  return "open";
}

function parseWordPressActions(content, handlerRel) {
  const re = /case\s+'([a-z0-9-]+)':/gi;
  let m;
  while ((m = re.exec(content)) !== null) {
    addRoute("POST", `wordpress/${m[1]}`, "open");
    addRoute("GET", `wordpress/${m[1]}`, "open");
  }
  void handlerRel;
}

function parseMcpTools(content) {
  const re = /'((?:DataForSEO_[a-zA-Z0-9_]+))'\s*=>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    addRoute("POST", `mcp/${m[1]}`, "open");
  }
  addRoute("POST", "mcp/DataForSEO_serp_google_ai_mode", "open");
}

function parseManagerHandlers(content, handlerRel) {
  const cloud = content.match(/function dispatch_cloud[\s\S]*?(?=function dispatch_properties)/);
  const props = content.match(/function dispatch_properties[\s\S]*$/);
  if (cloud) {
    parseExactRoutes(cloud[0], "manager-cloud-settings", "subpath", handlerRel);
  }
  if (props) {
    parseExactRoutes(props[0], "manager-wordpress-properties", "subpath", handlerRel);
  }
}

function scanHandlers() {
  for (const [rel, prefix] of Object.entries(HANDLER_PREFIX)) {
    const file = path.join(PLUGIN, rel);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    handlerFileContents.set(rel, content);
    if (rel.includes("manager-route")) {
      parseManagerHandlers(content, rel);
      continue;
    }
    if (rel.includes("wp-route")) {
      parseWordPressActions(content, rel);
      continue;
    }
    if (rel.includes("teams-route")) {
      addRoute("GET", "teams", "session");
      addRoute("POST", "teams", "session");
      addRoute("GET", "teams/invites/accept", "public");
      addRoute("GET", "teams/{teamId}", "session-team");
      addRoute("PATCH", "teams/{teamId}", "session-team");
      addRoute("DELETE", "teams/{teamId}", "session-team");
      parseExactRoutes(content, "teams/{teamId}", "sub", rel);
      parsePregRoutes(content, "teams/{teamId}", "sub", rel);
      parseExactRoutes(content, "teams", "route", rel);
      continue;
    }
    if (rel.includes("chat-route") || rel.includes("tasks-route")) {
      parseExactRoutes(content, prefix, "sub", rel);
      parsePregRoutes(content, prefix, "sub", rel);
      continue;
    }
    if (prefix) {
      parseExactRoutes(content, prefix, "subpath", rel);
      parsePregRoutes(content, prefix, "subpath", rel);
    }
  }

  const mcpFile = path.join(PLUGIN, "dataforseo/class-dataforseo-mcp-router.php");
  if (fs.existsSync(mcpFile)) parseMcpTools(fs.readFileSync(mcpFile, "utf8"));

  addRoute("GET", "dataforseo/serp-dump/{filename}", "open");
  addRoute("GET", "mcp/DataForSEO_serp_dump_download/{filename}", "open");
  addRoute("POST", "bulk/validate-internal-links", "open", { stream: true });
  addRoute("POST", "bulk/abort-dataforseo", "open");
  addRoute("GET", "wikipedia/api", "open");
  addRoute("POST", "entity-maps-image/generate", "open");
}


export { routes, routeHandlerMap, handlerFileContents, scanHandlers };
