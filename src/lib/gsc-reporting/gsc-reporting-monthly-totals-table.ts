import { formatCanadianNumber, parseCanadianNumber, splitCsvLine } from "@/lib/gsc-reporting/gsc-number-format";
import { GSC_SITE_TOTALS_BY_MONTH_FILENAME } from "@/lib/gsc-reporting/gsc-reporting-monthly-totals";
import { sortByMonthLabel } from "@/lib/gsc-reporting/gsc-reporting-table-sort";

export const GSC_SITE_TOTALS_BY_MONTH_TABLE_MARKER = "### Site search totals by month (GSC)";

const SEARCH_PERFORMANCE_H2_PREFIX = "## Search Performance This Period";

function escapePipeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

type MonthlyRow = {
  month: string;
  clk: number;
  imp: number;
  ctr: string;
  pos: number;
};

function parseSiteTotalsByMonthCsv(content: string): MonthlyRow[] {
  const rows: MonthlyRow[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.toLowerCase().startsWith("month,")) continue;
    const cells = splitCsvLine(line);
    if (cells.length < 5) continue;
    const clk = parseCanadianNumber(cells[1]?.trim() ?? "");
    const imp = parseCanadianNumber(cells[2]?.trim() ?? "");
    const pos = parseCanadianNumber(cells[4]?.trim() ?? "");
    rows.push({
      month: cells[0]?.trim() ?? "",
      clk: Number.isFinite(clk) ? clk : 0,
      imp: Number.isFinite(imp) ? imp : 0,
      ctr: cells[3]?.trim() ?? "—",
      pos: Number.isFinite(pos) ? pos : 0,
    });
  }
  return rows;
}

export function buildGscSiteTotalsByMonthMarkdownTable(csvContent: string, _periodLabel?: string): string {
  const rows = sortByMonthLabel(parseSiteTotalsByMonthCsv(csvContent), (r) => r.month);
  if (rows.length === 0) return "";

  const line = (cells: string[]) => `| ${cells.map((c) => escapePipeCell(c)).join(" | ")} |`;
  const body = rows.map((r) =>
    line([
      r.month,
      formatCanadianNumber(r.clk, 0),
      formatCanadianNumber(r.imp, 0),
      r.ctr,
      r.pos > 0 ? formatCanadianNumber(r.pos, 1) : "—",
    ]),
  );

  return [
    GSC_SITE_TOTALS_BY_MONTH_TABLE_MARKER,
    "",
    line(["Month", "Clk", "Imp", "CTR", "Pos"]),
    line(["---", "---:", "---:", "---:", "---:"]),
    ...body,
  ].join("\n");
}

export function siteTotalsByMonthTableFromBundledFiles(
  files: { name: string; content: string }[],
  periodLabel: string,
): string {
  const file = files.find((f) => f.name.trim() === GSC_SITE_TOTALS_BY_MONTH_FILENAME);
  if (!file?.content.trim()) return "";
  return buildGscSiteTotalsByMonthMarkdownTable(file.content, periodLabel);
}

export function spliceGscSiteTotalsByMonthIntoSearchPerformance(markdown: string, tableBlock: string): string {
  const block = tableBlock.trim();
  if (!block) return markdown;

  const idx = markdown.indexOf(SEARCH_PERFORMANCE_H2_PREFIX);
  if (idx < 0) return markdown;

  const after = markdown.indexOf("\n", idx);
  const bodyStart = after >= 0 ? after + 1 : idx;
  const nextH2 = markdown.indexOf("\n## ", bodyStart);
  const sectionEnd = nextH2 >= 0 ? nextH2 : markdown.length;
  const sectionBody = markdown.slice(bodyStart, sectionEnd);
  if (sectionBody.includes(GSC_SITE_TOTALS_BY_MONTH_TABLE_MARKER)) return markdown;

  const updatedSection = `${sectionBody.trimEnd()}\n\n${block}\n\n`;
  return markdown.slice(0, bodyStart) + updatedSection + markdown.slice(sectionEnd);
}
