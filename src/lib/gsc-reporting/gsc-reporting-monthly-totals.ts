import type { GscPagePerfRow, GscQueryPerfRow, GscSiteTotalsPreviousMonth } from "@/lib/gsc-reporting/gsc-reporting-fetch";
import { csvNumberCell, formatCanadianNumber } from "@/lib/gsc-reporting/gsc-number-format";

export type GscReportStructure = "compare" | "period_progress";

export const GSC_SITE_TOTALS_BY_MONTH_FILENAME = "Site-totals-by-month.csv";
export const GSC_QUERIES_PERIOD_FILENAME = "Queries-Period.csv";
export const GSC_PAGES_PERIOD_FILENAME = "Pages-Period.csv";

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatCtr(ctr: number): string {
  const c = ctr <= 1 ? ctr * 100 : ctr;
  return `${formatCanadianNumber(c)}%`;
}

function formatPosition(position: number): string {
  return formatCanadianNumber(position);
}

/** Site-wide KPIs per calendar month within the report period (no compare / Δ% columns). */
export function gscSiteTotalsByMonthCsv(months: GscSiteTotalsPreviousMonth[]): string {
  const lines: string[] = [
    "# Site-wide Search performance by calendar month within the report period.",
    "# Metrics are for each month only; no prior-period or MoM compare columns.",
    "#",
    "Month,Clk,Imp,CTR,Pos",
  ];

  for (const m of months) {
    lines.push(
      [
        escapeCsvCell(m.label),
        csvNumberCell(m.clicks),
        csvNumberCell(m.impressions),
        formatCtr(m.ctr),
        formatPosition(m.position),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function gscQueriesPeriodCsv(
  queries: GscQueryPerfRow[],
  periodLabel: string,
): string {
  const sorted = [...queries].sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
  const lines: string[] = [
    `# Queries for ${periodLabel}. One row per query; metrics are for the full report period.`,
    "#",
    "Query,Clicks,Impressions,CTR,Position",
  ];
  for (const q of sorted) {
    lines.push(
      [
        escapeCsvCell(q.query),
        csvNumberCell(q.clicks),
        csvNumberCell(q.impressions),
        formatCtr(q.ctr),
        formatPosition(q.position),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function gscPagesPeriodCsv(pages: GscPagePerfRow[], periodLabel: string): string {
  const sorted = [...pages].sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);
  const lines: string[] = [
    `# Pages for ${periodLabel}. One row per URL; metrics are for the full report period.`,
    "#",
    "Page,Clicks,Impressions,CTR,Position",
  ];
  for (const p of sorted) {
    lines.push(
      [
        escapeCsvCell(p.page),
        csvNumberCell(p.clicks),
        csvNumberCell(p.impressions),
        formatCtr(p.ctr),
        formatPosition(p.position),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function parseMonthlyTotalsFromApi(
  raw: unknown,
): GscSiteTotalsPreviousMonth[] {
  if (!Array.isArray(raw)) return [];
  const out: GscSiteTotalsPreviousMonth[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    const startDate = typeof r.startDate === "string" ? r.startDate.trim() : "";
    const endDate = typeof r.endDate === "string" ? r.endDate.trim() : "";
    if (!label || !startDate || !endDate) continue;
    out.push({
      label,
      startDate,
      endDate,
      clicks: Number(r.clicks) || 0,
      impressions: Number(r.impressions) || 0,
      ctr: Number(r.ctr) || 0,
      position: Number(r.position) || 0,
    });
  }
  return out;
}
