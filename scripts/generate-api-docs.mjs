#!/usr/bin/env node
/**
 * Scan NEO Pulse PHP route handlers and emit docs/api markdown + _manifest.json.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildManifest } from "./api-docs/manifest.mjs";
import { createApiDocContext, scanHandlers } from "./api-docs/scan-php-handlers.mjs";
import { writeRouteScaffolds } from "./api-docs/render-markdown.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLUGIN = path.join(ROOT, "wordpress-plugins/neo-pulse-app/includes");
const DOCS = path.join(ROOT, "docs/api");
const OVERRIDES = path.join(DOCS, "_overrides");

function main() {
  fs.mkdirSync(DOCS, { recursive: true });
  fs.mkdirSync(OVERRIDES, { recursive: true });
  const ctx = createApiDocContext();
  scanHandlers(PLUGIN, ctx);
  const { routes } = ctx;

  routes.sort((a, b) => {
    const c = a.path.localeCompare(b.path);
    return c !== 0 ? c : a.method.localeCompare(b.method);
  });

  writeRouteScaffolds(routes, DOCS, OVERRIDES, ctx);

  const manifest = buildManifest(routes, DOCS);
  console.log(`Generated ${routes.length} API route docs in docs/api/`);
  console.log(`Manifest: ${manifest.sections.length} sections`);
}

main();
