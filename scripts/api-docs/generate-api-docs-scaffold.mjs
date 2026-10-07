import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECTION_LABELS } from "./constants.mjs";
import { fileSlug, slugFromPath, titleFromPath, titleFromSegment } from "./path-utils.mjs";
import { analyzeRoute, buildOverview } from "./generate-api-docs-analyze.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DOCS = path.join(ROOT, "docs/api");
const OVERRIDES = path.join(DOCS, "_overrides");

function tableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function buildRequestTable(route, analysis) {
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

function buildResponseTable(analysis) {
  const keys = analysis?.responseFields ?? [];
  if (keys.length === 0) {
    return tableRow(["`success` / `ok`", "boolean", "Operation status when present"]) + "\n" +
      tableRow(["`error`", "string", "Error message on failure"]);
  }
  return keys
    .map((k) => tableRow([`\`${k}\``, "varies", "See handler response."]))
    .join("\n");
}

function buildErrorTable(analysis) {
  const errors = analysis?.errors ?? [];
  if (errors.length === 0) {
    return tableRow(["4xx/5xx", "varies", "See HTTP status and `error` field in body."]);
  }
  return errors
    .map((e) => tableRow([e.status, `\`${e.error}\``, "Returned when validation or auth fails."]))
    .join("\n");
}

function exampleJson(route, analysis) {
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

function scaffoldBody(route) {
  const analysis = analyzeRoute(route);
  const overview = buildOverview(route, analysis);
  const streamNote = route.stream
    ? "\n\n## Notes\n\nReturns `application/x-ndjson`. Read line-delimited JSON objects from the response body.\n"
    : "";

  const exampleBody = exampleJson(route, analysis);
  const hasBody = route.method !== "GET";

  return `${route.method} \`/api/${route.path}\`.

${overview}

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
${buildRequestTable(route, analysis)}

## Response

| Field | Type | Description |
| --- | --- | --- |
${buildResponseTable(analysis)}

## Errors

| Status | error | Cause |
| --- | --- | --- |
${buildErrorTable(analysis)}

## Example

\`\`\`bash
curl -X ${route.method} "https://neodigital.ca/api/${route.path}" \\
  -H "Content-Type: application/json" \\${hasBody ? `\n  -d '${exampleBody.replace(/\n/g, " ")}'` : ""}
\`\`\`

\`\`\`javascript
const res = await fetch(\`/api/${route.path}\`, {
  method: "${route.method}",
  credentials: "include",
  headers: { "Content-Type": "application/json" },${hasBody ? `\n  body: JSON.stringify(${exampleBody}),` : ""}
});
const data = await res.json();
\`\`\`
${streamNote}`;
}

function writeScaffold(route, order) {
  const slug = slugFromPath(route.path);
  const sectionKey = slug.split("/")[0];
  const title = route.title ?? titleFromPath(route.path, route.method);

  const overridePath = path.join(OVERRIDES, `${slug}.md`);
  if (fs.existsSync(overridePath)) {
    return overridePath;
  }

  const fm = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `slug: ${slug}`,
    `section: ${SECTION_LABELS[sectionKey] ?? titleFromSegment(sectionKey)}`,
    `method: ${route.method}`,
    `path: /api/${route.path}`,
    `auth: ${route.auth}`,
    `order: ${order}`,
    "---",
    "",
    scaffoldBody(route),
  ].join("\n");

  const dir = path.join(DOCS, ...slug.split("/").slice(0, -1));
  const base = fileSlug(route.path) || slug.replace(/\//g, "-");
  const fname = `${base}.md`;
  const full = path.join(dir || DOCS, fname);

  if (fs.existsSync(full)) {
    const existing = fs.readFileSync(full, "utf8");
    if (existing.includes("<!-- manual -->")) return full;
    const manualBlock = existing.match(/<!-- manual -->[\s\S]*/);
    if (manualBlock) {
      fs.writeFileSync(full, fm + "\n\n" + manualBlock[0]);
      return full;
    }
  }

  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, fm);
  return full;
}



export { writeScaffold };
