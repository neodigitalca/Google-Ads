import fs from "node:fs";
import path from "node:path";
import { SECTION_LABELS } from "./constants.mjs";
import {
  fileSlug,
  slugFromPath,
  titleFromPath,
  titleFromSegment,
} from "./path-utils.mjs";
import {
  analyzeRoute,
  buildOverview,
  buildRequestTable,
  buildResponseTable,
  buildErrorTable,
  exampleJson,
} from "./analyze-route.mjs";

function scaffoldBody(route, ctx) {
  const analysis = analyzeRoute(route, ctx);
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

function writeScaffold(route, order, docsDir, overridesDir, ctx) {
  const slug = slugFromPath(route.path);
  const sectionKey = slug.split("/")[0];
  const title = route.title ?? titleFromPath(route.path, route.method);

  const overridePath = path.join(overridesDir, `${slug}.md`);
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
    scaffoldBody(route, ctx),
  ].join("\n");

  const dir = path.join(docsDir, ...slug.split("/").slice(0, -1));
  const base = fileSlug(route.path) || slug.replace(/\//g, "-");
  const fname = `${base}.md`;
  const full = path.join(dir || docsDir, fname);

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

export function writeRouteScaffolds(routes, docsDir, overridesDir, ctx) {
  const written = [];
  routes.forEach((route, i) => {
    written.push(writeScaffold(route, (i + 1) * 10, docsDir, overridesDir, ctx));
  });
  return written;
}

