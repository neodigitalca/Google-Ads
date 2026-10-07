import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildManifest } from "./manifest.mjs";
import { routes, routeHandlerMap, handlerFileContents, scanHandlers } from "./generate-api-docs-scan.mjs";
import { writeScaffold } from "./generate-api-docs-scaffold.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const DOCS = path.join(ROOT, "docs/api");
const OVERRIDES = path.join(DOCS, "_overrides");

export function runGenerateApiDocs() {
  fs.mkdirSync(DOCS, { recursive: true });
  fs.mkdirSync(OVERRIDES, { recursive: true });
  routes.length = 0;
  routeHandlerMap.clear();
  handlerFileContents.clear();
  scanHandlers();

  routes.sort((a, b) => {
    const c = a.path.localeCompare(b.path);
    return c !== 0 ? c : a.method.localeCompare(b.method);
  });

  const written = [];
  routes.forEach((route, i) => {
    written.push(writeScaffold(route, (i + 1) * 10));
  });

  const manifest = buildManifest(routes, DOCS);
  console.log(`Generated ${routes.length} API route docs in docs/api/`);
  console.log(`Manifest: ${manifest.sections.length} sections`);

}

