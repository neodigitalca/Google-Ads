import {
  buildWideCompareMarkdownTable,
  parseMetricMomComparisonCsv,
} from "@/lib/gsc-reporting/gsc-reporting-wide-compare-table";

export const GSC_SITE_TOTALS_MOM_FILENAME = "Site-totals-MoM.csv";
export const GSC_SITE_TOTALS_TABLE_MARKER = "### Site search totals (GSC)";

const SITE_TOTALS_WIDE_METRICS: { csvLabel: string; column: string }[] = [
  { csvLabel: "Total clicks", column: "Clk" },
  { csvLabel: "Total impressions", column: "Imp" },
  { csvLabel: "Search queries", column: "Queries" },
  { csvLabel: "Average CTR", column: "CTR" },
  { csvLabel: "Average position", column: "Pos" },
];

export function buildGscSiteTotalsMarkdownTable(csvContent: string, compareLabel: string): string {
  const rows = parseMetricMomComparisonCsv(csvContent);
  return buildWideCompareMarkdownTable({
    heading: GSC_SITE_TOTALS_TABLE_MARKER,
    rows,
    metrics: SITE_TOTALS_WIDE_METRICS,
    compareLabel,
  });
}

export function siteTotalsTableFromBundledFiles(
  files: { name: string; content: string }[],
  compareLabel: string,
): string {
  const file = files.find((f) => f.name.trim() === GSC_SITE_TOTALS_MOM_FILENAME);
  if (!file?.content.trim()) return "";
  return buildGscSiteTotalsMarkdownTable(file.content, compareLabel);
}

const SEARCH_PERFORMANCE_H2_PREFIX = "## Search Performance Compared";

export function spliceGscSiteTotalsIntoSearchPerformance(markdown: string, tableBlock: string): string {
  const block = tableBlock.trim();
  if (!block) return markdown;

  const idx = markdown.indexOf(SEARCH_PERFORMANCE_H2_PREFIX);
  if (idx < 0) return markdown;

  const after = markdown.indexOf("\n", idx);
  const bodyStart = after >= 0 ? after + 1 : idx;
  const nextH2 = markdown.indexOf("\n## ", bodyStart);
  const sectionEnd = nextH2 >= 0 ? nextH2 : markdown.length;
  const sectionBody = markdown.slice(bodyStart, sectionEnd);
  if (sectionBody.includes(GSC_SITE_TOTALS_TABLE_MARKER)) return markdown;

  const updatedSection = `${sectionBody.trimEnd()}\n\n${block}\n\n`;
  return markdown.slice(0, bodyStart) + updatedSection + markdown.slice(sectionEnd);
}
