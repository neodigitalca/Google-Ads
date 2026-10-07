import Papa from "papaparse";
import { GSC_REPORT_MAX_TABLE_DATA_ROWS } from "@/lib/gsc-reporting/gsc-reporting-markdown-post";
import { GSC_PAGES_PERIOD_FILENAME } from "@/lib/gsc-reporting/gsc-reporting-monthly-totals";
import { formatCanadianNumber, parseCanadianNumber, splitCsvLine } from "@/lib/gsc-reporting/gsc-number-format";
import {
  buildAllowlistPathnameSet,
  isPagesMomReportingFile,
  pathnameKeyFromUrl,
  type SapEntityGrounding,
} from "@/lib/gsc-reporting/gsc-reporting-sap-entity-context";
import { humanPageLinkLabelFromUrl } from "@/lib/reporting/reporting-markdown-links";
import { sortByClicksDesc } from "@/lib/gsc-reporting/gsc-reporting-table-sort";

export const GSC_SAP_ENTITY_PAGES_TABLE_MARKER = "### Local and entity pages";

const SAP_PAGE_ROW_LIMIT = GSC_REPORT_MAX_TABLE_DATA_ROWS;

function escapePipeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function pageLinkCell(pageUrl: string): string {
  const url = pageUrl.trim();
  const label = humanPageLinkLabelFromUrl(url);
  return `[${escapePipeCell(label)}](${url})`;
}

function isExcludedCmsDuplicatePath(pathKey: string): boolean {
  const m = pathKey.match(/-(\d{1,2})$/);
  if (!m) return false;
  const n = parseInt(m[1]!, 10);
  return n >= 2 && n <= 30;
}

function pctDelta(primary: number, compare: number): string {
  if (!Number.isFinite(primary) || !Number.isFinite(compare) || compare === 0) return "0%";
  const pct = ((primary - compare) / compare) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

type SapPagePeriodRow = { page: string; clk: number; imp: number; pos: number };

function sapPageRowsFromPeriodCsv(csvText: string, pathKeys: Set<string>): SapPagePeriodRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  const headerIdx = lines.findIndex((l) => /^Page,/i.test(l.trimStart()));
  if (headerIdx < 0) return [];

  const out: SapPagePeriodRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]!);
    const page = parts[0]?.trim();
    if (!page) continue;
    const pk = pathnameKeyFromUrl(page);
    if (!pk || !pathKeys.has(pk) || isExcludedCmsDuplicatePath(pk)) continue;
    const clk = parseCanadianNumber(parts[1]?.trim() ?? "");
    const imp = parseCanadianNumber(parts[2]?.trim() ?? "");
    const pos = parseCanadianNumber(parts[4]?.trim() ?? "");
    out.push({
      page,
      clk: Number.isFinite(clk) ? clk : 0,
      imp: Number.isFinite(imp) ? imp : 0,
      pos: Number.isFinite(pos) ? pos : 0,
    });
  }
  return sortByClicksDesc(out, (r) => r.clk, (r) => r.imp);
}

type SapPageMomRow = SapPagePeriodRow & {
  clkCompare: number;
  impCompare: number;
  posCompare: number;
};

function sapPageRowsFromMomCsv(csvText: string, pathKeys: Set<string>): SapPageMomRow[] {
  const withoutComments = csvText
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
  const parsed = Papa.parse<Record<string, string>>(withoutComments, {
    header: true,
    skipEmptyLines: true,
  });
  const fields = parsed.meta.fields?.map((h) => String(h)) ?? [];
  const pageKey = fields.find((h) => h.trim().toLowerCase() === "page");
  if (!pageKey) return [];

  const col = (re: RegExp, after = -1): string | null => {
    for (let i = 0; i < fields.length; i++) {
      if (i <= after) continue;
      if (re.test(fields[i]?.trim() ?? "")) return fields[i]!;
    }
    return null;
  };

  const clkA = col(/^Clicks \(/);
  const clkB = clkA ? col(/^Clicks \(/, fields.indexOf(clkA)) : null;
  const impA = col(/^Impressions \(/);
  const impB = impA ? col(/^Impressions \(/, fields.indexOf(impA)) : null;
  const posA = col(/^Position \(/);
  const posB = posA ? col(/^Position \(/, fields.indexOf(posA)) : null;

  const num = (row: Record<string, string>, key: string | null): number => {
    if (!key) return 0;
    const n = parseCanadianNumber(String(row[key] ?? "").trim());
    return Number.isFinite(n) ? n : 0;
  };

  const out: SapPageMomRow[] = [];
  for (const row of parsed.data ?? []) {
    if (!row || typeof row !== "object") continue;
    const page = String(row[pageKey] ?? "").trim();
    if (!page) continue;
    const pk = pathnameKeyFromUrl(page);
    if (!pk || !pathKeys.has(pk) || isExcludedCmsDuplicatePath(pk)) continue;
    out.push({
      page,
      clk: num(row, clkA),
      clkCompare: num(row, clkB),
      imp: num(row, impA),
      impCompare: num(row, impB),
      pos: num(row, posA),
      posCompare: num(row, posB),
    });
  }
  return sortByClicksDesc(out, (r) => r.clk, (r) => r.imp);
}

function renderSapPeriodTable(rows: SapPagePeriodRow[]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const body = rows.slice(0, SAP_PAGE_ROW_LIMIT).map((r) =>
    line([
      pageLinkCell(r.page),
      formatCanadianNumber(r.clk, 0),
      formatCanadianNumber(r.imp, 0),
      r.pos > 0 ? formatCanadianNumber(r.pos, 2) : "—",
    ]),
  );
  return [
    GSC_SAP_ENTITY_PAGES_TABLE_MARKER,
    "",
    line(["Page", "Clk", "Imp", "Pos"]),
    line(["---", "---:", "---:", "---:"]),
    ...body,
  ].join("\n");
}

function renderSapMomTable(rows: SapPageMomRow[]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const body = rows.slice(0, SAP_PAGE_ROW_LIMIT).map((r) =>
    line([
      pageLinkCell(r.page),
      formatCanadianNumber(r.clk, 0),
      pctDelta(r.clk, r.clkCompare),
      formatCanadianNumber(r.imp, 0),
      pctDelta(r.imp, r.impCompare),
      r.pos > 0 ? formatCanadianNumber(r.pos, 2) : "—",
      pctDelta(r.pos, r.posCompare),
    ]),
  );
  return [
    GSC_SAP_ENTITY_PAGES_TABLE_MARKER,
    "",
    line(["Page", "Clk", "Clk Δ%", "Imp", "Imp Δ%", "Pos", "Pos Δ%"]),
    line(["---", "---:", "---:", "---:", "---:", "---:", "---:"]),
    ...body,
  ].join("\n");
}

export function sapEntityPagesTableFromBundledFiles(
  grounding: SapEntityGrounding,
  files: { name: string; content: string }[],
  options: { periodProgress?: boolean },
): string {
  if (grounding.allowlistUrls.length === 0) return "";
  const pathKeys = buildAllowlistPathnameSet(grounding.allowlistUrls);
  if (pathKeys.size === 0) return "";

  if (options.periodProgress) {
    const periodFile = files.find((f) => f.name.trim() === GSC_PAGES_PERIOD_FILENAME);
    if (!periodFile?.content.trim()) return "";
    const rows = sapPageRowsFromPeriodCsv(periodFile.content, pathKeys);
    if (rows.length === 0) return "";
    return renderSapPeriodTable(rows);
  }

  const momFile = files.find((f) => isPagesMomReportingFile(f.name, f.content));
  if (!momFile?.content.trim()) return "";
  const rows = sapPageRowsFromMomCsv(momFile.content, pathKeys);
  if (rows.length === 0) return "";
  return renderSapMomTable(rows);
}

/** Append injected SAP table when the model omitted the Page grid. */
export function injectSapEntityPagesTable(modelBody: string, table: string): string {
  const body = modelBody.trim();
  const injected = table.trim();
  if (!injected) return body;
  if (/\|\s*Page\s*\|/i.test(body)) return body;
  return `${body}\n\n${injected}\n`;
}
