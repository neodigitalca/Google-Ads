import { SECTION_LABELS } from "./constants.mjs";
import { titleFromSegment } from "./path-utils.mjs";

function extractFunctionBlock(content, fnName) {
  const re = new RegExp(`(?:private|public|protected)\\s+static\\s+function\\s+${fnName}\\s*\\([^)]*\\)[^{]*\\{`, "m");
  const match = re.exec(content);
  if (!match) return null;
  let i = match.index + match[0].length;
  let depth = 1;
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    i += 1;
  }
  return content.slice(match.index, i);
}

function extractDocblock(content, fnName) {
  const fnRe = new RegExp(`(?:private|public|protected)\\s+static\\s+function\\s+${fnName}\\s*\\(`, "m");
  const fnMatch = fnRe.exec(content);
  if (!fnMatch) return { summary: "", detail: "" };
  const before = content.slice(0, fnMatch.index);
  const all = [...before.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  if (all.length === 0) return { summary: "", detail: "" };
  const raw = all[all.length - 1][1];
  const lines = raw
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l && !l.startsWith("@"));
  let summary = lines[0] ?? "";
  let detail = lines.slice(1).join(" ").trim();
  if (summary.startsWith("/api/") || summary.includes("route handlers") || detail.includes("function dispatch")) {
    summary = "";
    detail = "";
  }
  if (detail.length > 400) {
    detail = detail.slice(0, 397) + "...";
  }
  return { summary, detail };
}

function fieldToVar(name) {
  return name.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "") || name;
}

function extractBodyFields(block) {
  /** @type {Map<string, { name: string, required: boolean, description: string }>} */
  const fields = new Map();
  const re = /\$body\s*\[\s*['"]([\w]+)['"]\s*\]/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    if (!fields.has(m[1])) {
      fields.set(m[1], { name: m[1], required: false, description: "Request body field" });
    }
  }
  for (const field of fields.values()) {
    const varName = fieldToVar(field.name);
    const patterns = [
      new RegExp(`\\$${varName}\\s*===\\s*''`),
      new RegExp(`'${field.name}'[^\\n]*Missing`),
    ];
    if (patterns.some((p) => p.test(block))) {
      field.required = true;
    }
  }
  if (block.includes("Missing required fields") || block.includes("Missing email or password")) {
    for (const field of fields.values()) {
      if (["email", "password", "inviteToken", "token"].includes(field.name)) {
        field.required = true;
      }
    }
  }
  return [...fields.values()];
}

function extractErrors(block) {
  /** @type {Array<{ status: string, error: string }>} */
  const errors = [];
  const re = /send_json\s*\(\s*array\s*\(\s*'ok'\s*=>\s*false\s*,\s*'error'\s*=>\s*'([^']+)'[^)]*\)\s*,\s*(\d+)\s*\)/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    errors.push({ error: m[1], status: m[2] });
  }
  const re2 = /send_json\s*\(\s*array\s*\(\s*'ok'\s*=>\s*false\s*,\s*'error'\s*=>\s*'([^']+)'[^)]*\)\s*\)/g;
  while ((m = re2.exec(block)) !== null) {
    if (!errors.some((e) => e.error === m[1])) {
      errors.push({ error: m[1], status: "400" });
    }
  }
  return errors;
}

function extractResponseFields(block) {
  /** @type {Set<string>} */
  const keys = new Set();
  const matches = block.matchAll(/send_json\s*\(\s*array\s*\(([\s\S]*?)\)\s*(?:,\s*\d+\s*)?\)/g);
  for (const m of matches) {
    if (m[1].includes("'ok' => false") || m[1].includes("'success' => false")) continue;
    const keyRe = /'([\w]+)'\s*=>/g;
    let km;
    while ((km = keyRe.exec(m[1])) !== null) {
      keys.add(km[1]);
    }
  }
  return [...keys];
}

export function analyzeRoute(route, ctx) {
  const { routeHandlerMap, handlerFileContents } = ctx;
  const key = `${route.method} ${route.path}`;
  const ref = routeHandlerMap.get(key);
  if (!ref) return null;
  const content = handlerFileContents.get(ref.rel);
  if (!content) return null;
  const block = extractFunctionBlock(content, ref.fn);
  if (!block) return null;
  const doc = extractDocblock(content, ref.fn);
  return {
    handlerFn: ref.fn,
    block,
    purpose: doc.summary,
    whenToUse: doc.detail,
    requestFields: extractBodyFields(block),
    responseFields: extractResponseFields(block),
    errors: extractErrors(block),
  };
}

function pathTail(apiPath) {
  const parts = apiPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? apiPath;
}

function pathTailLabel(apiPath) {
  const tail = pathTail(apiPath);
  if (tail.includes("{")) {
    const parts = apiPath.split("/").filter(Boolean);
    const parent = parts[parts.length - 2] ?? "resource";
    return `${titleFromSegment(parent).toLowerCase()} item`;
  }
  return titleFromSegment(tail).toLowerCase();
}

function extractInlineComment(block) {
  if (!block) return "";
  const head = block.slice(0, 900);
  for (const line of head.split("\n").slice(0, 14)) {
    const cm = line.match(/^\s*\/\/\s*(.{12,220})$/);
    if (cm && !cm[1].startsWith("@") && !cm[1].toLowerCase().includes("phpcs")) {
      return cm[1].trim();
    }
  }
  return "";
}

function overviewFromFunctionName(fn, route) {
  /** @type {Record<string, string>} */
  const known = {
    login:
      "Authenticates a user with email and password, sets the neo_pulse_session cookie, and returns basic profile fields.",
    logout: "Ends the current session and clears the neo_pulse_session cookie.",
    register: "Creates a user account from an invite token and signs the user in.",
    bootstrap: "Creates the first owner account when no users exist yet.",
    setup_admin: "Installs auth tables and creates the first agency owner on a fresh deploy.",
    classify_clients:
      "Classifies managed WordPress sites into vertical benchmark client tags using taxonomy rules and optional Gemini labeling via OpenRouter.",
    export_gsc_csv:
      "Builds a Google Search Console CSV export for vertical benchmark reporting across selected sites.",
  };
  if (known[fn]) return known[fn];

  const section = SECTION_LABELS[route.path.split("/")[0]] ?? titleFromSegment(route.path.split("/")[0]);
  const label = pathTailLabel(route.path);

  if (fn.startsWith("classify_")) {
    return `Classifies ${label} for ${section} using taxonomy rules and model-assisted tagging when configured.`;
  }
  if (fn.startsWith("export_")) {
    return `Exports ${label} data for ${section} workflows.`;
  }
  if (fn.startsWith("fetch_") || fn.startsWith("get_") || fn.startsWith("list_")) {
    return `Fetches ${label} from the ${section} API.`;
  }
  if (fn.startsWith("create_") || fn.startsWith("add_")) {
    return `Creates ${label} through the ${section} API.`;
  }
  if (fn.startsWith("update_") || fn.startsWith("patch_") || fn.startsWith("save_")) {
    return `Updates ${label} through the ${section} API.`;
  }
  if (fn.startsWith("delete_") || fn.startsWith("remove_")) {
    return `Removes ${label} through the ${section} API.`;
  }
  if (fn.startsWith("sync_")) {
    return `Synchronizes ${label} with external services in ${section}.`;
  }
  if (fn.startsWith("validate_")) {
    return `Validates ${label} and returns structured results from ${section}.`;
  }
  return "";
}

function genericOverview(route) {
  const section = SECTION_LABELS[route.path.split("/")[0]] ?? titleFromSegment(route.path.split("/")[0]);
  const label = pathTailLabel(route.path);
  const tail = pathTail(route.path);

  if (route.method === "GET") {
    if (tail.includes("{")) return `Fetches a single ${label} from the ${section} API.`;
    return `Reads ${label} from the ${section} API.`;
  }
  if (route.method === "POST") {
    if (route.path.includes("bulk")) return `Runs a bulk ${section.toLowerCase()} operation from a JSON request body.`;
    return `Runs the ${label} action in the ${section} API from a JSON request body.`;
  }
  if (route.method === "PATCH") return `Updates ${label} through the ${section} API.`;
  if (route.method === "DELETE") return `Removes ${label} through the ${section} API.`;
  return `Handles ${label} on the ${section} API.`;
}

function authOverviewNote(auth) {
  if (auth === "public") return "No existing session is required.";
  if (auth === "session") return "Requires a signed-in user with a valid neo_pulse_session cookie.";
  if (auth === "session-team") return "Requires a signed-in user who belongs to the team id in the path.";
  if (auth === "team-rbac-communication") {
    return "Requires a signed-in team member with communication permissions.";
  }
  return "";
}

function responseOverviewNote(analysis) {
  const keys = (analysis?.responseFields ?? []).filter((k) => !["ok", "success", "error"].includes(k));
  if (keys.length === 0) return "";
  if (keys.length === 1) return `On success, returns \`${keys[0]}\`.`;
  const shown = keys.slice(0, 4).map((k) => `\`${k}\``).join(", ");
  return `On success, returns ${shown}${keys.length > 4 ? ", and related fields" : ""}.`;
}

export function buildOverview(route, analysis) {
  const sentences = [];

  if (analysis?.purpose) {
    sentences.push(analysis.purpose);
    if (analysis.whenToUse && !analysis.purpose.includes(analysis.whenToUse.slice(0, 24))) {
      sentences.push(analysis.whenToUse);
    }
  } else {
    const inline = extractInlineComment(analysis?.block);
    const fromFn = analysis?.handlerFn ? overviewFromFunctionName(analysis.handlerFn, route) : "";
    if (inline) sentences.push(inline);
    else if (fromFn) sentences.push(fromFn);
    else sentences.push(genericOverview(route));
  }

  const authNote = authOverviewNote(route.auth);
  if (authNote && !sentences.join(" ").toLowerCase().includes("session")) {
    sentences.push(authNote);
  }

  const respNote = responseOverviewNote(analysis);
  if (respNote && !sentences.join(" ").toLowerCase().includes("returns")) {
    sentences.push(respNote);
  }

  if (route.stream) {
    sentences.push("Streams progress as NDJSON instead of a single JSON object.");
  }

  return sentences.join(" ");
}

function tableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

export function buildRequestTable(route, analysis) {
  if (route.method === "GET") {
    return tableRow(["_(none)_", "—", "—", "No JSON body for GET requests."]);
  }
  const fields = analysis?.requestFields ?? [];
  if (fields.length === 0) {
    return tableRow(["_(optional)_", "object", "no", "JSON body shape depends on the action."]);
  }
  return fields
    .map((f) =>
      tableRow([`\`${f.name}\``, "string", f.required ? "yes" : "no", f.description]),
    )
    .join("\n");
}

export function buildResponseTable(analysis) {
  const keys = analysis?.responseFields ?? [];
  if (keys.length === 0) {
    return tableRow(["`success` / `ok`", "boolean", "Operation status when present"]) + "\n" +
      tableRow(["`error`", "string", "Error message on failure"]);
  }
  return keys
    .map((k) => tableRow([`\`${k}\``, "varies", "See handler response."]))
    .join("\n");
}

export function buildErrorTable(analysis) {
  const errors = analysis?.errors ?? [];
  if (errors.length === 0) {
    return tableRow(["4xx/5xx", "varies", "See HTTP status and `error` field in body."]);
  }
  return errors
    .map((e) => tableRow([e.status, `\`${e.error}\``, "Returned when validation or auth fails."]))
    .join("\n");
}

export function exampleJson(route, analysis) {
  const fields = analysis?.requestFields?.filter((f) => f.required) ?? [];
  if (fields.length === 0) return "{}";
  const obj = {};
  for (const f of fields) {
    if (f.name === "email") obj.email = "you@example.com";
    else if (f.name === "password") obj.password = "your-password";
    else if (f.name === "inviteToken") obj.inviteToken = "invite-token";
    else if (f.name === "displayName") obj.displayName = "Your Name";
    else if (f.name === "teamName") obj.teamName = "My Agency";
    else if (f.name === "jobTitle") obj.jobTitle = "Lead SEO";
    else if (f.name === "setupKey") obj.setupKey = "your-setup-key";
    else obj[f.name] = "...";
  }
  return JSON.stringify(obj, null, 2);
}
