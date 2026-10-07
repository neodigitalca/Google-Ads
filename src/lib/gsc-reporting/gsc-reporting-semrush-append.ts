import type { WordPressSite } from "@/components/integrations/types";
import {
  fetchSemrushPositionTrackingCompare,
  type SemrushPositionTrackingCompareRow,
} from "@/lib/wordpress-api/semrush";
import { formatGscComparePeriodLabel } from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import type { GscReportingSectionResult } from "@/lib/gsc-reporting/gsc-reporting-types";

export type GscReportingDateRange = { startDate: string; endDate: string };

export const GSC_REPORTING_SEM_H2 = "## SEM: Semrush Position Tracking";

/** Injected Semrush table row cap (executive scan limit). */
export const GSC_REPORTING_SEMRUSH_TABLE_ROW_LIMIT = 10;

function formatPositionCell(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "-";
  if (v <= 0) return "20+";
  return String(Math.round(v * 10) / 10);
}

function formatChangeCell(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "-";
  const rounded = Math.round(v * 10) / 10;
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return String(rounded);
  return "0";
}

function rankSortKey(position: number | null | undefined): number {
  if (position == null || !Number.isFinite(position) || position <= 0) return 999;
  return position;
}

function sortSemrushRowsForCompare(rows: SemrushPositionTrackingCompareRow[]): SemrushPositionTrackingCompareRow[] {
  return [...rows].sort((a, b) => {
    const da = Math.abs(a.change ?? 0);
    const db = Math.abs(b.change ?? 0);
    if (db !== da) return db - da;
    return rankSortKey(a.primaryPosition) - rankSortKey(b.primaryPosition);
  });
}

function sortSemrushRowsForPeriod(rows: SemrushPositionTrackingCompareRow[]): SemrushPositionTrackingCompareRow[] {
  return [...rows].sort(
    (a, b) => rankSortKey(a.primaryPosition) - rankSortKey(b.primaryPosition) || a.keyword.localeCompare(b.keyword),
  );
}

export function buildSemrushPositionTrackingPeriodMarkdownTable(
  rows: SemrushPositionTrackingCompareRow[],
): string {
  const header = ["| Kw | Pos |", "| --- | --- |"];
  const data = sortSemrushRowsForPeriod(rows)
    .slice(0, GSC_REPORTING_SEMRUSH_TABLE_ROW_LIMIT)
    .map((r) => {
      const kw = r.keyword.replace(/\|/g, "\\|");
      return `| ${kw} | ${formatPositionCell(r.primaryPosition)} |`;
    });
  return [...header, ...data].join("\n");
}

export function buildSemrushPositionTrackingMarkdownTable(
  rows: SemrushPositionTrackingCompareRow[],
  periodLabels?: { primary: string; compare: string },
): string {
  const posCur = periodLabels?.primary?.trim() || "Current";
  const posPrior = periodLabels?.compare?.trim() || "Prior";
  const header = [
    `| Kw | ${posCur} | ${posPrior} | Δ |`,
    "| --- | --- | --- | --- |",
  ];
  const data = sortSemrushRowsForCompare(rows)
    .slice(0, GSC_REPORTING_SEMRUSH_TABLE_ROW_LIMIT)
    .map((r) => {
      const kw = r.keyword.replace(/\|/g, "\\|");
      return `| ${kw} | ${formatPositionCell(r.primaryPosition)} | ${formatPositionCell(r.comparePosition)} | ${formatChangeCell(r.change)} |`;
    });
  return [...header, ...data].join("\n");
}

function formatSemUnavailableReason(
  reason?: string,
  message?: string,
): string {
  if (reason?.trim() === "no_api_key") {
    return "Semrush API key missing. Dashboard, API Keys, Semrush: paste your v3 API key and Save.";
  }
  if (reason?.trim() === "invalid_api_key") {
    return (
      message?.trim() ||
      "Semrush Position Tracking needs your v3 API key from Semrush Profile, Subscription info, API units. MCP tokens (semrtkn-pat) do not work here."
    );
  }
  let msg = message?.trim() ?? "";
  if (msg.startsWith("{")) {
    try {
      const parsed = JSON.parse(msg) as { error?: string };
      if (typeof parsed.error === "string") {
        msg = parsed.error;
      }
    } catch {
      /* use raw */
    }
  }
  const lo = msg.toLowerCase();
  if (lo.includes("authorize") || lo.includes("wrong key")) {
    return "Semrush Position Tracking needs your v3 API key from Semrush Profile, Subscription info, API units. MCP tokens (semrtkn-pat) do not work here.";
  }
  if (msg) return msg;
  const r = reason?.trim();
  if (r && r !== "no_api_key") return r;
  return "no data returned";
}

export function buildGscReportingSemMarkdownBlock(args: {
  rows: SemrushPositionTrackingCompareRow[];
  skipped?: boolean;
  reason?: string;
  message?: string;
  primaryLabel: string;
  compareLabel: string;
  periodProgress?: boolean;
}): string {
  const periodLabels = { primary: args.primaryLabel, compare: args.compareLabel };

  if (args.skipped || args.rows.length === 0) {
    const why = formatSemUnavailableReason(args.reason, args.message);
    return [GSC_REPORTING_SEM_H2, "", `Semrush position tracking unavailable: ${why}`, ""].join("\n");
  }

  if (args.periodProgress) {
    const table = buildSemrushPositionTrackingPeriodMarkdownTable(args.rows);
    const intro =
      "Top 10 tracked keywords from Semrush Position Tracking for this report window (best average position in the period).";
    return [GSC_REPORTING_SEM_H2, "", intro, "", table, ""].join("\n");
  }

  const table = buildSemrushPositionTrackingMarkdownTable(args.rows, periodLabels);
  const intro =
    "Top 10 tracked keywords from Semrush Position Tracking for this report window (by largest absolute rank movement).";
  return [GSC_REPORTING_SEM_H2, "", intro, "", table, ""].join("\n");
}

export function siteHasSemrushPositionTrackingConfigured(site: WordPressSite): boolean {
  return Boolean(site.semrushPositionTrackingCampaignId?.trim());
}

export async function buildGscReportingSemrushMarkdownSection(args: {
  site: WordPressSite;
  fetchRange: GscReportingDateRange;
  compareFetchRange: GscReportingDateRange;
  trackedSiteUrl: string;
  periodProgress?: boolean;
}): Promise<string> {
  const campaignId = args.site.semrushPositionTrackingCampaignId?.trim() ?? "";
  if (!campaignId) return "";

  const projectId = args.site.semrushPositionTrackingProjectId?.trim() ?? "";
  const primaryLabel = formatGscComparePeriodLabel(
    args.fetchRange.startDate,
    args.fetchRange.endDate,
  );
  const compareLabel = formatGscComparePeriodLabel(
    args.compareFetchRange.startDate,
    args.compareFetchRange.endDate,
  );

  const periodProgress = Boolean(args.periodProgress);
  const result = await fetchSemrushPositionTrackingCompare({
    projectId: projectId || undefined,
    campaignId,
    primaryStart: args.fetchRange.startDate,
    primaryEnd: args.fetchRange.endDate,
    compareStart: args.compareFetchRange.startDate,
    compareEnd: args.compareFetchRange.endDate,
    trackedUrl: args.trackedSiteUrl,
    periodOnly: periodProgress,
  });

  const rows = result.rows ?? [];
  if (result.skipped || rows.length === 0) {
    return buildGscReportingSemMarkdownBlock({
      rows: [],
      skipped: true,
      reason: result.reason,
      message: result.message,
      primaryLabel,
      compareLabel,
      periodProgress,
    });
  }

  return buildGscReportingSemMarkdownBlock({
    rows,
    primaryLabel,
    compareLabel,
    periodProgress,
  });
}

/** Insert SEM block immediately after the Search Performance section in assembled report markdown. */
export function spliceSemPositionTrackingAfterSearchPerformance(
  markdown: string,
  sectionResults: GscReportingSectionResult[],
  semBlock: string,
): string {
  const block = semBlock.trim();
  if (!block) return markdown;

  const searchSection = sectionResults.find((row) => row.plan.kind === "search_performance_period");
  if (!searchSection?.markdownBlock?.trim()) {
    return `${markdown.trimEnd()}\n\n${block}\n`;
  }

  const searchHeading =
    searchSection.markdownBlock.split("\n").find((line) => line.startsWith("## "))?.trim() ??
    (searchSection.plan.h2Title.trim() ? `## ${searchSection.plan.h2Title.trim()}` : "");

  if (!searchHeading) {
    return `${markdown.trimEnd()}\n\n${block}\n`;
  }

  const startIdx = markdown.indexOf(searchHeading);
  if (startIdx < 0) {
    return `${markdown.trimEnd()}\n\n${block}\n`;
  }

  const nextH2Idx = markdown.indexOf("\n## ", startIdx + searchHeading.length);
  const insertAt = nextH2Idx >= 0 ? nextH2Idx : markdown.length;
  return `${markdown.slice(0, insertAt).trimEnd()}\n\n${block}\n\n${markdown.slice(insertAt).trimStart()}`.trimEnd() + "\n";
}
