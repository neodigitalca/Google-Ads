/**
 * Deterministic SAP grounding: filter GSC Pages MoM rows to URLs from the entity sitemap allowlist.
 */
import type { WordPressSite } from "@/components/integrations/types";
import Papa from "papaparse";
import { isEntitySitemapDisabled } from "@/lib/entity-endpoint-extractor";
import { parseSitemap } from "@/lib/wordpress-api";
import { GSC_PAGES_PERIOD_FILENAME } from "@/lib/gsc-reporting/gsc-reporting-monthly-totals";
import { parseCanadianNumber, splitCsvLine } from "@/lib/gsc-reporting/gsc-number-format";

export const GSC_SITEMAPS_BUNDLE_FILENAME = "GSC-sitemaps.csv";

/** Common SAP-related sitemap filenames (reference / tests; not guessed on origin during reporting). */
export const SAP_CANONICAL_SITEMAP_LEAVES = [
  "service-area-sitemap.xml",
  "service-areas-sitemap.xml",
  "service_area-sitemap.xml",
  "location-sitemap.xml",
  "locations-sitemap.xml",
  "entity-sitemap.xml",
] as const;

/** Max characters for the synthetic FILTERED_PAGES_FOR_SAP block (fits retrieval budget). */
export const SAP_FILTERED_PAGES_MAX_CHARS = 12_000;

/** Max extra child sitemap XML fetches per report (local + entity). */
const SAP_EXTRA_SITEMAP_PARSE_LIMIT = 12;

/** Bundle file: SAP URL allowlist (entity sitemap + local service area pages). */
export const GSC_ENTITY_SITEMAP_URLS_FILENAME = "Entity-sitemap-urls.csv";

/** Path prefixes for local service area landings (city/area pages) in SAP. */
export const SAP_LOCAL_PATHNAME_PREFIXES = [
  "/service-area",
  "/service-areas",
  "/location",
  "/locations",
] as const;

const SAP_CHILD_SITEMAP_FILENAME =
  /(?:^|\/)(service-area|service-areas|location|locations|local|near|entity)[^/]*\.xml$/i;

function sitemapLeafLooksLikeSapSource(leaf: string): boolean {
  const lower = leaf.toLowerCase();
  if (SAP_CHILD_SITEMAP_FILENAME.test(leaf)) return true;
  if (!lower.includes("sitemap")) return false;
  return (
    lower.includes("service-area") ||
    lower.includes("service-areas") ||
    lower.includes("service_area") ||
    lower.includes("location") ||
    lower.includes("entity")
  );
}

function pathOrUrlLooksLikeSapSitemap(pathOrUrl: string): boolean {
  const t = pathOrUrl.trim();
  if (!t) return false;
  const leaf = t.split("/").filter(Boolean).pop() ?? t;
  return sitemapLeafLooksLikeSapSource(leaf);
}

/** Resolve GSC / relative sitemap path to absolute URL on the report property. */
export function resolveAbsoluteSitemapUrl(pathOrUrl: string, publicSiteUrl: string): string | null {
  const t = pathOrUrl.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const origin = siteOriginFromPublicUrl(publicSiteUrl);
  if (!origin) return null;
  return t.startsWith("/") ? `${origin}${t}` : `${origin}/${t}`;
}

/** Paths from Search Console submitted sitemaps bundle (column Path). */
export function gscSubmittedSitemapPathsFromBundle(files: { name: string; content: string }[]): string[] {
  const file = files.find((f) => f.name.trim() === GSC_SITEMAPS_BUNDLE_FILENAME);
  if (!file?.content.trim()) return [];
  const parsed = Papa.parse<Record<string, string>>(file.content, {
    header: true,
    skipEmptyLines: true,
  });
  const pathKey = parsed.meta.fields?.find((h) => h.trim().toLowerCase() === "path");
  if (!pathKey) return [];
  const out: string[] = [];
  for (const row of parsed.data ?? []) {
    const p = String(row[pathKey] ?? "").trim();
    if (p) out.push(p);
  }
  return out;
}

/**
 * Every SAP-related sitemap XML to parse: entity config, service-area sitemap, GSC submissions, site index children.
 */
export function discoverReportingSapSitemapUrls(args: {
  site: WordPressSite;
  publicSiteUrl: string;
  files?: { name: string; content: string }[];
}): string[] {
  const disabled = new Set(
    (args.site.sitemaps?.disabledChildSitemapUrls ?? []).map((u) => u.trim()).filter(Boolean),
  );
  const candidates = new Set<string>();

  const consider = (raw: string) => {
    const abs = resolveAbsoluteSitemapUrl(raw, args.publicSiteUrl);
    if (!abs || disabled.has(abs)) return;
    if (pathOrUrlLooksLikeSapSitemap(abs)) candidates.add(abs);
  };

  const entityUrl = args.site.entitySitemapUrl?.trim();
  if (entityUrl && !isEntitySitemapDisabled(args.site)) {
    consider(entityUrl);
  }

  for (const raw of args.site.sitemaps?.childSitemaps ?? []) {
    consider(raw);
  }
  for (const raw of Object.keys(args.site.sitemaps?.endpoints ?? {})) {
    consider(raw);
  }

  for (const path of gscSubmittedSitemapPathsFromBundle(args.files ?? [])) {
    consider(path);
  }

  return [...candidates].slice(0, SAP_EXTRA_SITEMAP_PARSE_LIMIT);
}

export type SapEntityGrounding = {
  /** Human-readable source (e.g. entity sitemap filename). */
  sourceLabel: string;
  /** Resolved canonical URLs from the entity sitemap (same-origin filtered upstream). */
  allowlistUrls: string[];
  /** CSV-shaped excerpt: only Pages MoM rows whose Page matches allowlist pathnames. */
  filteredPagesEvidence: string;
};

export function siteOriginFromPublicUrl(publicSiteUrl: string): string {
  const t = publicSiteUrl.trim();
  if (!t) return "";
  try {
    return new URL(t).origin;
  } catch {
    return "";
  }
}

/** Pathname key for matching Page cells to entity sitemap URLs (lowercase, no trailing slash except root). */
export function pathnameKeyFromUrl(urlStr: string): string | null {
  const raw = urlStr.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    let p = u.pathname.toLowerCase();
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p;
  } catch {
    return null;
  }
}

export function buildAllowlistPathnameSet(allowlistUrls: string[]): Set<string> {
  const set = new Set<string>();
  for (const u of allowlistUrls) {
    const k = pathnameKeyFromUrl(u);
    if (k) set.add(k);
  }
  return set;
}

/** Keep only URLs on the report property origin. */
export function filterUrlsToSiteOrigin(urls: string[], publicSiteUrl: string): string[] {
  const origin = siteOriginFromPublicUrl(publicSiteUrl).toLowerCase();
  if (!origin) return [...urls];
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw.trim();
    if (!u) continue;
    try {
      if (new URL(u).origin.toLowerCase() === origin) out.push(u);
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

export function entitySitemapUrlsBundleCsv(allowlistUrls: string[], sourceLabel: string): string {
  const header = `# ${sourceLabel.trim() || "Entity sitemap"}\nurl`;
  if (allowlistUrls.length === 0) return `${header}\n`;
  return `${header}\n${allowlistUrls.join("\n")}\n`;
}

export function appendEntitySitemapUrlsBundleFile(
  files: { name: string; content: string }[],
  allowlistUrls: string[],
  sourceLabel: string,
): void {
  if (files.some((f) => f.name.trim() === GSC_ENTITY_SITEMAP_URLS_FILENAME)) return;
  files.push({
    name: GSC_ENTITY_SITEMAP_URLS_FILENAME,
    content: entitySitemapUrlsBundleCsv(allowlistUrls, sourceLabel),
  });
}

export function pathnameMatchesSapLocalOrEntityArea(pathKey: string | null): boolean {
  if (!pathKey) return false;
  const p = pathKey.toLowerCase();
  for (const pref of SAP_LOCAL_PATHNAME_PREFIXES) {
    if (p === pref || p.startsWith(`${pref}/`)) return true;
  }
  return false;
}

export function dedupeSapAllowlistUrls(urls: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of urls) {
    const u = raw.trim();
    if (!u) continue;
    const k = pathnameKeyFromUrl(u);
    if (k && !byKey.has(k)) byKey.set(k, u);
  }
  return [...byKey.values()];
}

async function fetchSitemapUrlsOnOrigin(args: {
  site: WordPressSite;
  sitemapUrl: string;
  publicSiteUrl: string;
}): Promise<string[]> {
  const user = args.site.username?.trim();
  const pass = args.site.appPassword?.trim();
  const result = await parseSitemap(
    args.site.siteUrl,
    args.sitemapUrl,
    user || undefined,
    pass || undefined,
  );
  const raw = (result?.urls ?? []).map((u) => String(u ?? "").trim()).filter((u) => u.length > 0);
  return filterUrlsToSiteOrigin(raw, args.publicSiteUrl);
}

/** Entity sitemap + service-area sitemap + local sitemaps (Integrations, GSC submissions, canonical XML). */
export async function resolveReportingSapAllowlistFromSitemaps(args: {
  site: WordPressSite;
  publicSiteUrl: string;
  files?: { name: string; content: string }[];
}): Promise<{ allowlistUrls: string[]; sourceLabel: string }> {
  const sitemapXmlUrls = discoverReportingSapSitemapUrls(args);
  const labels: string[] = [];
  const merged: string[] = [];

  for (const sitemapUrl of sitemapXmlUrls) {
    const leaf = sitemapUrl.split("/").filter(Boolean).pop() ?? sitemapUrl;
    if (!labels.includes(leaf)) labels.push(leaf);
    merged.push(
      ...(await fetchSitemapUrlsOnOrigin({
        site: args.site,
        sitemapUrl,
        publicSiteUrl: args.publicSiteUrl,
      })),
    );
  }

  const allowlistUrls = dedupeSapAllowlistUrls(merged);
  if (allowlistUrls.length === 0) {
    return {
      allowlistUrls: [],
      sourceLabel:
        sitemapXmlUrls.length > 0
          ? "Entity + service area sitemaps (XML loaded but no page URLs)"
          : "Entity / service area sitemap (none discovered)",
    };
  }
  const sourceLabel =
    labels.length > 0
      ? `Entity + service area sitemaps (${labels.join(", ")})`
      : "Entity + service area sitemaps";
  return { allowlistUrls, sourceLabel };
}

/** @deprecated Use resolveReportingSapAllowlistFromSitemaps */
export async function resolveReportingSapEntityAllowlist(args: {
  site: WordPressSite;
  publicSiteUrl: string;
}): Promise<{ allowlistUrls: string[]; sourceLabel: string }> {
  return resolveReportingSapAllowlistFromSitemaps(args);
}

function pageUrlsFromPeriodCsv(csvText: string): string[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  const headerIdx = lines.findIndex((l) => /^Page,/i.test(l.trimStart()));
  if (headerIdx < 0) return [];
  const out: string[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const page = splitCsvLine(lines[i]!)[0]?.trim();
    if (page) out.push(page);
  }
  return out;
}

function pageUrlsFromMomCsv(csvText: string): string[] {
  const lines = csvText.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i]!.trim().startsWith("#")) i++;
  const parsed = Papa.parse<Record<string, string>>(lines.slice(i).join("\n"), {
    header: true,
    skipEmptyLines: true,
  });
  const pageKey = parsed.meta.fields?.find((h) => h.trim().toLowerCase() === "page");
  if (!pageKey) return [];
  const out: string[] = [];
  for (const row of parsed.data ?? []) {
    const page = String(row[pageKey] ?? "").trim();
    if (page) out.push(page);
  }
  return out;
}

/** Add local service area page URLs from GSC Pages exports (e.g. /location/cochrane/). */
export function expandSapAllowlistFromPagesFiles(args: {
  allowlistUrls: string[];
  files: { name: string; content: string }[];
  publicSiteUrl: string;
}): string[] {
  const origin = siteOriginFromPublicUrl(args.publicSiteUrl).toLowerCase();
  const merged = [...args.allowlistUrls];
  for (const f of args.files) {
    const n = f.name.trim();
    const isPeriod = n === GSC_PAGES_PERIOD_FILENAME;
    const isMom = isPagesMomReportingFile(f.name, f.content);
    if (!isPeriod && !isMom) continue;
    const pages = isPeriod ? pageUrlsFromPeriodCsv(f.content) : pageUrlsFromMomCsv(f.content);
    for (const page of pages) {
      try {
        if (origin && new URL(page).origin.toLowerCase() !== origin) continue;
      } catch {
        continue;
      }
      const pk = pathnameKeyFromUrl(page);
      if (pathnameMatchesSapLocalOrEntityArea(pk)) merged.push(page);
    }
  }
  return dedupeSapAllowlistUrls(merged);
}

/** Full SAP allowlist: sitemaps then GSC Pages paths for local/entity landings. */
export async function resolveReportingSapAllowlist(args: {
  site: WordPressSite;
  publicSiteUrl: string;
  files: { name: string; content: string }[];
}): Promise<{ allowlistUrls: string[]; sourceLabel: string }> {
  const fromSitemaps = await resolveReportingSapAllowlistFromSitemaps({
    site: args.site,
    publicSiteUrl: args.publicSiteUrl,
    files: args.files,
  });
  const allowlistUrls = expandSapAllowlistFromPagesFiles({
    allowlistUrls: fromSitemaps.allowlistUrls,
    files: args.files,
    publicSiteUrl: args.publicSiteUrl,
  });
  return {
    allowlistUrls,
    sourceLabel: fromSitemaps.sourceLabel,
  };
}

/** Pages MoM bundle file from fetch or uploads with the same naming pattern. */
export function isPagesMomReportingFile(name: string, content?: string): boolean {
  const n = name.toLowerCase();
  if (n === "pages-mom.csv" || (n.includes("pages") && n.includes("mom"))) return true;
  if (content !== undefined && /#\s*Pages:\s*MoM/i.test(content)) return true;
  return false;
}

function stripLeadingCommentLines(text: string): string {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim().startsWith("#")) i++;
  return lines.slice(i).join("\n");
}

function parsePrimaryImpressions(fields: string[], row: Record<string, unknown>): number {
  const imprKey = fields.find((f) => /^\s*Impressions\s+\(/i.test(f.trim()));
  if (!imprKey) return 0;
  const raw = row[imprKey];
  const s = String(raw ?? "")
    .trim()
    .replace(/,/g, "");
  if (s === "" || s === "-" || s === "–" || s === "—") return 0;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build FILTERED_PAGES_FOR_SAP CSV body from Pages MoM exports in `files`.
 */
export function buildSapFilteredPagesEvidence(args: {
  files: { name: string; content: string }[];
  allowlistUrls: string[];
  maxChars?: number;
}): string {
  const maxChars = args.maxChars ?? SAP_FILTERED_PAGES_MAX_CHARS;
  const pathKeys = buildAllowlistPathnameSet(args.allowlistUrls);
  if (pathKeys.size === 0) return "";

  const pagesFiles = args.files.filter((f) => isPagesMomReportingFile(f.name, f.content));
  if (pagesFiles.length === 0) return "";

  const blocks: string[] = [];

  for (const f of pagesFiles) {
    const withoutComments = stripLeadingCommentLines(f.content);
    const parsed = Papa.parse<Record<string, string>>(withoutComments, {
      header: true,
      skipEmptyLines: true,
    });
    const fields = parsed.meta.fields?.map((h) => String(h)) ?? [];
    if (!fields.some((h) => h.trim().toLowerCase() === "page")) continue;

    const pageKey = fields.find((h) => h.trim().toLowerCase() === "page");
    if (!pageKey) continue;

    const rows = (parsed.data ?? []).filter((r) => r && typeof r === "object");
    const matched: Record<string, unknown>[] = [];
    for (const r of rows) {
      const pageCell = String((r as Record<string, unknown>)[pageKey] ?? "").trim();
      if (!pageCell) continue;
      const pk = pathnameKeyFromUrl(pageCell);
      if (pk && pathKeys.has(pk)) matched.push(r as Record<string, unknown>);
    }

    matched.sort((a, b) => {
      const clkKey = fields.find((f) => /^\s*Clicks\s+\(/i.test(f.trim()));
      if (clkKey) {
        const na = parseCanadianNumber(String(a[clkKey] ?? "").trim());
        const nb = parseCanadianNumber(String(b[clkKey] ?? "").trim());
        if (Number.isFinite(na) && Number.isFinite(nb) && nb !== na) return nb - na;
      }
      return parsePrimaryImpressions(fields, b) - parsePrimaryImpressions(fields, a);
    });

    const preamble = [
      `# Filtered from ${f.name}: entity + local service area URL pathnames only.`,
      `#`,
    ].join("\n");

    const body =
      matched.length === 0
        ? "# No Page rows in this file matched entity allowlist pathnames."
        : Papa.unparse({ fields, data: matched });

    blocks.push(`${preamble}\n${body}`);
  }

  let out = blocks.join("\n\n---\n\n");
  if (out.length > maxChars) {
    out =
      out.slice(0, maxChars) +
      `\n\n[…truncated FILTERED_PAGES_FOR_SAP to ${maxChars} characters; rows sorted by primary-period impressions…]`;
  }
  return out.trim();
}

export function buildSapEntityGrounding(args: {
  files: { name: string; content: string }[];
  allowlistUrls: string[];
  sourceLabel: string;
  publicSiteUrl: string;
  maxFilteredChars?: number;
}): SapEntityGrounding {
  void args.publicSiteUrl;
  const filteredPagesEvidence = buildSapFilteredPagesEvidence({
    files: args.files,
    allowlistUrls: args.allowlistUrls,
    maxChars: args.maxFilteredChars,
  });
  return {
    sourceLabel: args.sourceLabel.trim() || "Entity sitemap",
    allowlistUrls: [...args.allowlistUrls],
    filteredPagesEvidence,
  };
}

const SAP_ALLOWLIST_CHUNK_MAX_CHARS = 5_000;

/**
 * Instruction block pinned ahead of retrieval so the SAP writer grounds on entity URLs only.
 */
export function buildSapEntityAllowlistChunkText(grounding: SapEntityGrounding): string {
  const n = grounding.allowlistUrls.length;
  if (n === 0) {
    return [
      "--- BLOCK: ENTITY_SITEMAP_ALLOWLIST ---",
      `Source label: ${grounding.sourceLabel}`,
      "NO resolved entity sitemap URLs for this property.",
      "Do not build a SAP Page performance table from generic Pages MoM rows (homepage, retail-store, blog, etc.). State briefly that entity sitemap URLs could not be loaded. Omit the pipe table.",
    ].join("\n");
  }
  const header = [
    "--- BLOCK: ENTITY_SITEMAP_ALLOWLIST ---",
    `Source: ${grounding.sourceLabel}`,
    `Allowlist: ${n} URLs (entity sitemap + **service area sitemap** + local landings). SAP **Page** table rows must use **only** URLs from this list (pathname match).`,
    "Ignore other Pages CSV rows elsewhere in RETRIEVED DATA for the SAP table.",
    "Do not repeat query-theme bullets from other sections in SAP.",
    "",
    "URLs:",
  ].join("\n");
  let body = grounding.allowlistUrls.join("\n");
  const cap = Math.max(500, SAP_ALLOWLIST_CHUNK_MAX_CHARS - header.length - 80);
  if (body.length > cap) {
    body = `${body.slice(0, cap)}\n[…truncated URL list…]`;
  }
  return `${header}\n${body}`;
}

export function buildSapFilteredPagesChunkText(grounding: SapEntityGrounding): string {
  const ev = grounding.filteredPagesEvidence.trim();
  if (!ev) {
    return [
      "--- BLOCK: FILTERED_PAGES_FOR_SAP ---",
      "# No Pages-MoM excerpt matched entity pathnames (or no Pages-MoM file in bundle).",
      "Still restrict SAP **Page** rows to ENTITY_SITEMAP_ALLOWLIST URLs only; cite metrics only when present in this bundle.",
    ].join("\n");
  }
  return `--- BLOCK: FILTERED_PAGES_FOR_SAP ---\n${ev}`;
}
