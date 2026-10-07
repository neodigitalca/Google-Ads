#!/usr/bin/env node
/**
 * Tag reporting clients on the Properties roster (profileTags: reporting-shortcut).
 * Usage: node scripts/seed-reporting-shortcut-profile-tags.mjs [--file path/to/sites.json]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TAG = "reporting-shortcut";

const TARGET_LABELS = [
  "Tailored Interiors",
  "Blinds West",
  "Blind Magic",
  "In The Shade",
  "DM Interiors",
  "Superior Blinds",
  "Advance Blinds",
  "Blind Spot",
  "Interiors By Laura",
  "KWB",
  "You Junk It",
];

/** Normalized name must contain this substring (case-insensitive). */
const CONTAINS_ALIASES = {
  "Advance Blinds": "advance blinds",
  "In The Shade": "in the shade",
  "Interiors By Laura": "interiors by laura",
};

function normalizeName(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function siteMatchesLabel(siteName, label) {
  const n = normalizeName(siteName);
  const alias = CONTAINS_ALIASES[label];
  if (alias) return n.includes(alias.replace(/[^a-z0-9]+/g, " ").trim());
  return n === normalizeName(label);
}

function defaultSitesPath() {
  const root = path.dirname(fileURLToPath(import.meta.url));
  return path.join(root, "..", "server", "data", "neo-pulse-wordpress-sites.json");
}

function parseArgs(argv) {
  let file = defaultSitesPath();
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) {
      file = path.resolve(argv[++i]);
    }
  }
  return { file };
}

function loadSites(file) {
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return { sites: parsed, wrap: null };
  if (Array.isArray(parsed.sites)) return { sites: parsed.sites, wrap: parsed };
  throw new Error(`Expected array or { sites: [] } in ${file}`);
}

function writeSites(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const { file } = parseArgs(process.argv);
if (!fs.existsSync(file)) {
  console.error(`Sites file not found: ${file}`);
  process.exit(1);
}

const { sites, wrap } = loadSites(file);
const unmatched = [];
const matched = [];

for (const label of TARGET_LABELS) {
  const site = sites.find((s) => siteMatchesLabel(s.name, label));
  if (!site) {
    unmatched.push(label);
    continue;
  }
  const tags = new Set(Array.isArray(site.profileTags) ? site.profileTags : []);
  tags.add(TAG);
  site.profileTags = [...tags];
  matched.push({ label, name: site.name, id: site.id });
}

if (wrap) {
  writeSites(file, { ...wrap, sites });
} else {
  writeSites(file, sites);
}

console.log("Matched and tagged:");
for (const m of matched) {
  console.log(`  ${m.label} -> ${m.name} (${m.id})`);
}

if (unmatched.length) {
  console.error("\nUnmatched (no property with this name):");
  for (const u of unmatched) console.error(`  ${u}`);
  process.exit(1);
}

console.log(`\nUpdated ${file}`);
