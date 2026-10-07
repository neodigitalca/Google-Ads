import type { WordPressSite } from "@/components/integrations/types";
import { sanitizeStrategistMarkdownSection } from "@/lib/competitor-research/competitor-report-markdown-sanitize";
import { callGscReportingOpenRouterChatCompletion } from "@/lib/gsc-reporting/gsc-reporting-openrouter";
import {
  buildLocalGridSummary,
  dominantKeywordFromRows,
  parseLocalDominatorCsv,
  type LocalDominatorRow,
} from "@/lib/local-dominator-csv";
import type { GscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import { gscReportingSupplementsHasContent } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";

function normalizeBusinessToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function filterRowsForClientBusiness(rows: LocalDominatorRow[], siteName: string): LocalDominatorRow[] {
  const want = normalizeBusinessToken(siteName);
  if (!want) return [];
  return rows.filter((r) => {
    const b = normalizeBusinessToken(r.business);
    if (!b) return false;
    return b.includes(want) || want.includes(b);
  });
}

function rowsForLocalInsightsAnalysis(rows: LocalDominatorRow[], siteName: string): LocalDominatorRow[] {
  const clientRows = filterRowsForClientBusiness(rows, siteName);
  if (clientRows.length > 0) return clientRows;
  const kw = dominantKeywordFromRows(rows).trim();
  if (!kw) return rows;
  const byKw = rows.filter((r) => r.keyword.trim() === kw);
  return byKw.length > 0 ? byKw : rows;
}

function imageMarkdownBlock(images: GscReportingSupplementFiles["images"]): string {
  const lines: string[] = ["### Local grid map", ""];
  for (const img of images) {
    if (!img.dataUrl.trim()) continue;
    const alt = img.name.replace(/\|/g, " ").trim() || "Local Dominator screenshot";
    lines.push(`![${alt}](${img.dataUrl})`, "");
  }
  return lines.join("\n").trim();
}

const LOCAL_INSIGHTS_SYSTEM = `You are a local SEO analyst writing one report section from Local Dominator grid exports.
Use only the grid statistics and screenshot filenames provided. Do not invent ranks, keywords, or cities not supported by the data.
Write concise markdown body text only (no leading ## heading). Use short paragraphs and bullet lists where helpful.
Mention geographic patterns (strong vs weak areas) when the grid stats support it.`;

export async function buildGscReportingLocalInsightsMarkdownSection(args: {
  site: WordPressSite;
  compareLabel: string;
  supplements?: GscReportingSupplementFiles;
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}): Promise<string> {
  const supplements = args.supplements;
  if (!gscReportingSupplementsHasContent(supplements)) return "";

  const images = supplements?.images ?? [];
  const csvText = supplements?.localDominatorCsv?.trim() ?? "";

  let gridStatsMarkdown = "";
  if (csvText) {
    const parsed = parseLocalDominatorCsv(csvText, { defaultKeyword: args.site.name });
    if (parsed.error || parsed.rows.length === 0) {
      if (images.length === 0) return "";
    } else {
      const analysisRows = rowsForLocalInsightsAnalysis(parsed.rows, args.site.name);
      if (analysisRows.length === 0 && images.length === 0) return "";
      const summary = buildLocalGridSummary(analysisRows, { rowsForGeographicScope: parsed.rows });
      gridStatsMarkdown = summary.summaryMarkdown;
    }
  }

  if (!gridStatsMarkdown && images.length === 0) return "";

  const screenshotNote =
    images.length > 0
      ? images.map((i) => i.name).filter(Boolean).join(", ")
      : "none";

  const user = [
    `Client: ${args.site.name}`,
    `Report period: ${args.compareLabel}`,
    "",
    "Grid statistics (Local Dominator CSV):",
    gridStatsMarkdown || "(No CSV stats; use screenshots only.)",
    "",
    `Screenshot files attached in report: ${screenshotNote}`,
    "",
    "Write the Local Insights narrative for the client.",
  ].join("\n");

  const { content } = await callGscReportingOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: LOCAL_INSIGHTS_SYSTEM,
    user,
    maxTokens: 4096,
    signal: args.signal,
  });

  let body = sanitizeStrategistMarkdownSection(content.trim());
  body = body.replace(/^##\s+Local Insights\s*\n+/i, "").trim();

  const imageBlock = images.length > 0 ? imageMarkdownBlock(images) : "";
  const parts = ["## Local Insights", "", body];
  if (imageBlock) {
    parts.push("", imageBlock);
  }
  parts.push("");
  return parts.join("\n");
}
