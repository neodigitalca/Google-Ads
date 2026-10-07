#!/usr/bin/env node
/**
 * Write googleAdsCustomerId onto reporting/PPC properties (MCC roster + Advance + aliases).
 * Usage: node scripts/seed-google-ads-customer-ids.mjs [--base http://127.0.0.1:8080]
 */

/** Same roster as REPORTING_SHORTCUT_CLIENT_LABELS in wordpress-property-profile-tags.ts */
const REPORTING_PPC_CLIENT_LABELS = [
  "Tailored Interiors",
  "Blinds West",
  "Blind Magic",
  "In The Shade",
  "DM Interiors",
  "Superior Blinds",
  "Blind Spot",
  "Interiors By Laura",
  "KWB",
  "You Junk It",
];

/** Property mirror `name` → customer id when MCC descriptive name differs. */
const EXTRA_ADS_ID_BY_SITE_NAME = {
  "Shutter Spot": "7454061453",
  "You Junk It... I Dump It": "6293305294",
};

/** MCC Google Ads descriptive name → Integrations property `name`. */
const MCC_NAME_TO_PROPERTY_NAME = {
  "Blind Spot": ["Shutter Spot"],
  "Lindsey Blinds Etc": ["Lindsey Blinds"],
  "Interiors By Laura": ["Interiors by Laura"],
  "You Junk It": ["You Junk It... I Dump It"],
};

function parseBase(argv) {
  let base = "http://127.0.0.1:8080";
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--base" && argv[i + 1]) base = argv[++i].replace(/\/$/, "");
  }
  return base;
}

function normName(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMccLookup(clients) {
  const byNorm = new Map();
  for (const row of clients) {
    const customerId = String(row.customerId ?? "").replace(/\D/g, "");
    const mccName = String(row.name ?? "").trim();
    if (customerId.length !== 10 || !mccName) continue;
    byNorm.set(normName(mccName), { customerId, mccName });
  }
  return byNorm;
}

function propertyNamesForMccRow(mccName) {
  const extras = MCC_NAME_TO_PROPERTY_NAME[mccName];
  if (extras?.length) return [mccName, ...extras];
  return [mccName];
}

/** property name → 10-digit id from MCC + extras (reporting roster only). */
function buildPropertyAdsIdMap(mccByNorm) {
  const map = new Map();
  for (const [mccNorm, row] of mccByNorm) {
    for (const propertyName of propertyNamesForMccRow(row.mccName)) {
      map.set(normName(propertyName), row.customerId);
    }
  }
  for (const [propertyName, id] of Object.entries(EXTRA_ADS_ID_BY_SITE_NAME)) {
    map.set(normName(propertyName), id.replace(/\D/g, ""));
  }
  return map;
}

function siteMatchesReportingRoster(siteName) {
  const n = normName(siteName);
  for (const label of REPORTING_PPC_CLIENT_LABELS) {
    const labelNorm = normName(label);
    if (labelNorm === "you junk it" && n.includes("you junk it")) return true;
    if (labelNorm === "in the shade" && n.includes("in the shade")) return true;
    if (labelNorm === "interiors by laura" && n.includes("interiors by laura")) return true;
    if (labelNorm === "blind spot" && (n === "shutter spot" || n === "blind spot")) return true;
    if (n === labelNorm) return true;
  }
  return false;
}

const base = parseBase(process.argv);
const loadUrl = `${base}/api/manager-wordpress-properties/load`;
const saveUrl = `${base}/api/manager-wordpress-properties/save`;
const mccUrl = `${base}/api/google-ads/list-mcc-clients`;

const mccRes = await fetch(mccUrl, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
let mccByNorm = new Map();
if (mccRes.ok) {
  const mccJson = await mccRes.json();
  if (mccJson.success && Array.isArray(mccJson.clients)) {
    mccByNorm = buildMccLookup(mccJson.clients);
  }
} else {
  console.warn(`MCC list failed (${mccRes.status}); using extras only.`);
}

const adsIdByPropertyNorm = buildPropertyAdsIdMap(mccByNorm);

const loadRes = await fetch(`${loadUrl}?_=${Date.now()}`, { credentials: "include" });
if (!loadRes.ok) {
  console.error(`Load failed: ${loadRes.status}`);
  process.exit(1);
}
const loadJson = await loadRes.json();
const sites = Array.isArray(loadJson.sites) ? loadJson.sites : [];
let updated = 0;
const nextSites = sites.map((site) => {
  const name = String(site.name ?? "").trim();
  if (!siteMatchesReportingRoster(name)) return site;
  const id = adsIdByPropertyNorm.get(normName(name)) ?? "";
  if (id.length !== 10) return site;
  const current = String(site.googleAdsCustomerId ?? "").replace(/\D/g, "");
  if (current === id) return site;
  updated += 1;
  return { ...site, googleAdsCustomerId: id };
});

if (updated === 0) {
  console.log("No reporting properties needed googleAdsCustomerId updates.");
  process.exit(0);
}

const saveRes = await fetch(saveUrl, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sites: nextSites }),
});
if (!saveRes.ok) {
  console.error(`Save failed: ${saveRes.status}`);
  process.exit(1);
}
console.log(`Updated googleAdsCustomerId on ${updated} reporting property(ies).`);
