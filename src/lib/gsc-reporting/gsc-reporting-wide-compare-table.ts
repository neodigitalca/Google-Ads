import {
  GSC_TABLE_SIDE_CURRENT,
  GSC_TABLE_SIDE_DELTA,
  GSC_TABLE_SIDE_PRIOR,
  gscCompareTablePeriodFootnote,
} from "@/lib/gsc-reporting/gsc-reporting-table-labels";

export type WideCompareMetricRow = {
  metric: string;
  periodA: string;
  periodB: string;
  momPct: string;
};

export type WideCompareColumn = {
  column: string;
  periodA: string;
  periodB: string;
  momPct: string;
};

function escapePipeCell(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (line.charAt(i + 1) === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseMetricMomComparisonCsv(content: string): WideCompareMetricRow[] {
  const rows: WideCompareMetricRow[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.toLowerCase().startsWith("metric,")) continue;
    const cells = parseCsvLine(line);
    if (cells.length < 4) continue;
    rows.push({
      metric: cells[0]?.trim() ?? "",
      periodA: cells[1]?.trim() ?? "",
      periodB: cells[2]?.trim() ?? "",
      momPct: cells[3]?.trim() ?? "",
    });
  }
  return rows;
}

function rowByMetric(rows: WideCompareMetricRow[], label: string): WideCompareMetricRow | undefined {
  const want = label.trim().toLowerCase();
  return rows.find((r) => r.metric.trim().toLowerCase() === want);
}

export function buildWideCompareMarkdownTable(args: {
  heading: string;
  subheading?: string;
  metrics: { csvLabel: string; column: string }[];
  rows: WideCompareMetricRow[];
  compareLabel: string;
}): string {
  if (args.rows.length === 0) return "";

  const columns: WideCompareColumn[] = args.metrics.map(({ csvLabel, column }) => {
    const row = rowByMetric(args.rows, csvLabel);
    return {
      column,
      periodA: row?.periodA ?? "—",
      periodB: row?.periodB ?? "—",
      momPct: row?.momPct ?? "—",
    };
  });

  const line = (cells: string[]) =>
    `| ${cells.map((c) => escapePipeCell(c)).join(" | ")} |`;

  const headerCols = columns.map((c) => c.column);
  const footnote = gscCompareTablePeriodFootnote(args.compareLabel);

  const lines: string[] = [
    args.heading,
    "",
  ];
  if (args.subheading?.trim()) {
    lines.push(args.subheading, "");
  }
  lines.push(
    line(["", ...headerCols]),
    line(["---", ...headerCols.map(() => "---:")]),
    line([GSC_TABLE_SIDE_CURRENT, ...columns.map((c) => c.periodA)]),
    line([GSC_TABLE_SIDE_PRIOR, ...columns.map((c) => c.periodB)]),
    line([GSC_TABLE_SIDE_DELTA, ...columns.map((c) => c.momPct)]),
  );
  if (footnote) {
    lines.push("", footnote);
  }
  lines.push("");
  return lines.join("\n").trimEnd();
}
