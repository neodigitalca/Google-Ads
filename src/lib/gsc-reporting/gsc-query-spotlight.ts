/**
 * Per-query MoM spotlight narratives (impression expansion vs position dilution).
 */
import type { GscQueryPerfRow } from "@/lib/gsc-reporting/gsc-reporting-fetch";
import { formatCanadianNumber } from "@/lib/gsc-reporting/gsc-number-format";

export const GSC_QUERY_SPOTLIGHT_FILENAME = "Query-spotlight-narrative.txt";

export type QuerySpotlightPattern = "impression_footprint_expansion";

export type QuerySpotlight = {
  query: string;
  pattern: QuerySpotlightPattern;
  impressionsPrimary: number;
  impressionsCompare: number;
  impressionsPct: number | null;
  positionPrimary: number;
  positionCompare: number;
  interpretation: string;
  forbiddenFraming: string;
};

const MIN_CURRENT_IMPRESSIONS = 20;
const MIN_IMPRESSIONS_PCT = 50;

function pctDelta(primary: number, compare: number): number | null {
  if (!Number.isFinite(primary) || !Number.isFinite(compare) || compare === 0) return null;
  return ((primary - compare) / compare) * 100;
}

function localIntentBoost(query: string): number {
  const q = query.toLowerCase();
  if (q.includes("near me")) return 1000;
  if (/\b(blinds|shades|window|coverings)\b/.test(q)) return 100;
  return 0;
}

export function deriveQuerySpotlights(
  primaryQueries: GscQueryPerfRow[],
  compareQueries: GscQueryPerfRow[],
  maxSpotlights = 3,
): QuerySpotlight[] {
  const compareMap = new Map<string, GscQueryPerfRow>();
  for (const row of compareQueries) {
    const k = row.query.trim();
    if (k) compareMap.set(k, row);
  }

  const candidates: Array<{ spotlight: QuerySpotlight; score: number }> = [];

  for (const p of primaryQueries) {
    const query = p.query.trim();
    if (!query) continue;
    const c = compareMap.get(query);
    if (!c) continue;

    const impP = p.impressions;
    const impC = c.impressions;
    if (impP < MIN_CURRENT_IMPRESSIONS) continue;
    if (impP <= impC) continue;

    const impPct = pctDelta(impP, impC);
    if (impPct == null || impPct < MIN_IMPRESSIONS_PCT) continue;
    if (p.position <= c.position) continue;

    const interpretation =
      `Google showed the site for many more searches for ${query}. ` +
      `Impressions rose from ${formatCanadianNumber(impC)} to ${formatCanadianNumber(impP)}. ` +
      `Average position moved from ${c.position.toFixed(1)} to ${p.position.toFixed(1)} because visibility broadened across more search instances, not because the term dropped out of results.`;

    const spotlight: QuerySpotlight = {
      query,
      pattern: "impression_footprint_expansion",
      impressionsPrimary: impP,
      impressionsCompare: impC,
      impressionsPct: impPct,
      positionPrimary: p.position,
      positionCompare: c.position,
      interpretation,
      forbiddenFraming:
        "Do not describe this query as overall visibility loss, ranking collapse, or search decline.",
    };

    const score = impP - impC + localIntentBoost(query);
    candidates.push({ spotlight, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, maxSpotlights).map((c) => c.spotlight);
}

export function querySpotlightNarrativeFileContent(spotlights: QuerySpotlight[]): string {
  const lines = [
    "QUERY_SPOTLIGHT_NARRATIVE (authoritative for listed queries; obey in Executive Summary and insights)",
    "",
  ];
  if (spotlights.length === 0) {
    lines.push("spotlights: none");
    return `${lines.join("\n")}\n`;
  }
  for (const s of spotlights) {
    lines.push(`query: ${s.query}`);
    lines.push(`pattern: ${s.pattern}`);
    lines.push(
      `impressions: ${s.impressionsCompare} → ${s.impressionsPrimary} (${s.impressionsPct != null ? (s.impressionsPct >= 0 ? "+" : "") + s.impressionsPct.toFixed(1) : " - "}% )`,
    );
    lines.push(`avgPosition: ${s.positionCompare.toFixed(1)} → ${s.positionPrimary.toFixed(1)} (higher number = lower on page)`);
    lines.push(`interpretation: ${s.interpretation}`);
    lines.push(`forbiddenFraming: ${s.forbiddenFraming}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function querySlugForSparklineFile(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function sparklineArchiveFileName(query: string): string {
  const slug = querySlugForSparklineFile(query) || "query";
  return `gsc-sparkline-${slug}.svg`;
}

export function buildQuerySpotlightPinChunk(
  files: { name: string; content: string }[],
): { id: string; sourceFile: string; text: string } | null {
  const file = files.find((f) => f.name === GSC_QUERY_SPOTLIGHT_FILENAME);
  if (!file?.content.trim()) return null;
  return {
    id: "query-spotlight",
    sourceFile: GSC_QUERY_SPOTLIGHT_FILENAME,
    text: `--- FILE: ${GSC_QUERY_SPOTLIGHT_FILENAME} ---\n${file.content.trim()}`,
  };
}

export const QUERY_SPOTLIGHT_LEXICON = `**QUERY_SPOTLIGHT_NARRATIVE (when present in RETRIEVED DATA):** For each listed \`query\` with \`pattern: impression_footprint_expansion\`, **lead with expanded search presence and impression growth** before any average-position note. Treat a higher avg position as **mix dilution from broader visibility**, not as "visibility declined" for that query. Obey each \`forbiddenFraming\` line.`;
