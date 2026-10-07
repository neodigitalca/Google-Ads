import {
  GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME,
  GA_ORGANIC_TRAFFIC_ACQUISITION_MOM_FILENAME,
} from "@/lib/gsc-reporting/gsc-reporting-fetch";
import { buildGaOrganicTrafficAcquisitionByMonthMarkdownTable } from "@/lib/gsc-reporting/gsc-reporting-ga-acquisition-monthly";
import {
  buildWideCompareMarkdownTable,
  parseMetricMomComparisonCsv,
  type WideCompareMetricRow,
} from "@/lib/gsc-reporting/gsc-reporting-wide-compare-table";

export type GaOrganicMomCsvRow = WideCompareMetricRow;

const WIDE_TABLE_METRICS: { csvLabel: string; column: string }[] = [
  { csvLabel: "Organic sessions", column: "Sess" },
  { csvLabel: "Engaged sessions", column: "Eng sess" },
  { csvLabel: "Engagement rate", column: "Eng rate" },
  { csvLabel: "Average engagement time per session", column: "Avg eng" },
  { csvLabel: "Events per session", column: "Ev/sess" },
  { csvLabel: "Event count", column: "Events" },
  { csvLabel: "Key events", column: "Key ev" },
];

export function parseGaOrganicTrafficAcquisitionMomCsv(content: string): GaOrganicMomCsvRow[] {
  return parseMetricMomComparisonCsv(content);
}

export function buildGaOrganicTrafficAcquisitionMarkdownTable(
  rows: GaOrganicMomCsvRow[],
  compareLabel: string,
): string {
  return buildWideCompareMarkdownTable({
    heading: "### Organic Search traffic acquisition",
    metrics: WIDE_TABLE_METRICS,
    rows,
    compareLabel,
  });
}

export function buildGaOrganicTrafficTableFromCompareLabel(
  csvContent: string,
  compareLabel: string,
): string {
  const rows = parseGaOrganicTrafficAcquisitionMomCsv(csvContent);
  if (rows.length === 0) return "";
  return buildGaOrganicTrafficAcquisitionMarkdownTable(rows, compareLabel);
}

const WEBSITE_TRAFFIC_H2 = "## Website Traffic From Organic Search";
const TABLE_MARKER = "### Organic Search traffic acquisition";
const TABLE_MARKER_MONTHLY = "### Organic Search traffic acquisition";

export function spliceOrganicTrafficAcquisitionTableIntoMarkdown(
  markdown: string,
  tableBlock: string,
): string {
  const block = tableBlock.trim();
  if (!block) return markdown;

  const idx = markdown.indexOf(WEBSITE_TRAFFIC_H2);
  if (idx < 0) return markdown;

  const after = idx + WEBSITE_TRAFFIC_H2.length;
  const nextH2 = markdown.indexOf("\n## ", after);
  const sectionEnd = nextH2 >= 0 ? nextH2 : markdown.length;
  const sectionBody = markdown.slice(after, sectionEnd);
  if (sectionBody.includes(TABLE_MARKER) || sectionBody.includes(TABLE_MARKER_MONTHLY)) {
    return markdown;
  }

  const updatedSection = `${sectionBody.trimEnd()}\n\n${block}\n\n`;
  return markdown.slice(0, after) + updatedSection + markdown.slice(sectionEnd);
}

export function organicTrafficTableFromBundledFiles(
  files: { name: string; content: string }[],
  compareLabel: string,
): string {
  void compareLabel;
  const monthly = files.find((f) => f.name.trim() === GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME);
  if (monthly?.content.trim()) {
    return buildGaOrganicTrafficAcquisitionByMonthMarkdownTable(monthly.content);
  }
  const file = files.find((f) => f.name.trim() === GA_ORGANIC_TRAFFIC_ACQUISITION_MOM_FILENAME);
  if (!file?.content.trim()) return "";
  return buildGaOrganicTrafficTableFromCompareLabel(file.content, compareLabel);
}
