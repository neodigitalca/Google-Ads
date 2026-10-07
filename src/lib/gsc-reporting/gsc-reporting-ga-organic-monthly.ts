import { formatCanadianNumber } from "@/lib/gsc-reporting/gsc-number-format";
import { sortByMonthLabel } from "@/lib/gsc-reporting/gsc-reporting-table-sort";
import type { GA4OrganicUsersMonthlyBlock } from "@/components/integrations/types";

export const GA_ORGANIC_USERS_BY_MONTH_FILENAME = "GA-Organic-Users-By-Month.csv";

export function gaUserKeyEventRateDisplay(rate: number): string {
  if (!Number.isFinite(rate)) return " - ";
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(2)}%`;
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function gaOrganicUsersByMonthCsv(
  block: GA4OrganicUsersMonthlyBlock,
): string {
  const lines: string[] = [
    `# GA4 organic traffic (${block.periodStart} → ${block.periodEnd})`,
    "# Source: first user medium = organic (User acquisition). Not Google Search Console.",
    "Month,Total users,New users,User key event rate,Key events",
  ];
  for (const row of block.months) {
    lines.push(
      [
        escapeCsvCell(row.label),
        escapeCsvCell(formatCanadianNumber(row.totalUsers)),
        escapeCsvCell(formatCanadianNumber(row.newUsers)),
        escapeCsvCell(gaUserKeyEventRateDisplay(row.userKeyEventRate)),
        escapeCsvCell(formatCanadianNumber(row.keyEvents)),
      ].join(","),
    );
  }
  const t = block.totals;
  lines.push(
    "",
    "# Period total (organic medium, full report range)",
    "Metric,Value",
    `Total users,${formatCanadianNumber(t.totalUsers)}`,
    `New users,${formatCanadianNumber(t.newUsers)}`,
    `User key event rate,${gaUserKeyEventRateDisplay(t.userKeyEventRate)}`,
    `Key events,${formatCanadianNumber(t.keyEvents)}`,
  );
  return lines.join("\n");
}

export type GaOrganicUsersMonthRow = {
  label: string;
  totalUsers: number;
  newUsers: number;
  userKeyEventRate: number;
  keyEvents: number;
};

export function parseGaOrganicUsersByMonthCsv(content: string): {
  months: GaOrganicUsersMonthRow[];
  totals: GaOrganicUsersMonthRow | null;
} {
  const months: GaOrganicUsersMonthRow[] = [];
  let totals: GaOrganicUsersMonthRow | null = null;
  let inTotals = false;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      if (t.includes("Period total")) inTotals = false;
      continue;
    }
    if (t.startsWith("Month,")) continue;
    if (t.startsWith("Metric,Value")) {
      inTotals = true;
      continue;
    }
    if (inTotals) {
      continue;
    }
    const parts = t.split(",");
    if (parts.length < 5) continue;
    const label = parts[0]?.trim() ?? "";
    const parseIntCell = (s: string) => {
      const n = Number(String(s).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    };
    const rateRaw = parts[3]?.trim() ?? "";
    const rateNum = parseFloat(rateRaw.replace("%", ""));
    months.push({
      label,
      totalUsers: parseIntCell(parts[1] ?? "0"),
      newUsers: parseIntCell(parts[2] ?? "0"),
      userKeyEventRate: Number.isFinite(rateNum) ? (rateRaw.includes("%") ? rateNum / 100 : rateNum) : 0,
      keyEvents: parseIntCell(parts[4] ?? "0"),
    });
  }
  const totalUsersMatch = content.match(/^Total users,([^\n]+)/m);
  const newUsersMatch = content.match(/^New users,([^\n]+)/m);
  const rateMatch = content.match(/^User key event rate,([^\n]+)/m);
  const keyEventsMatch = content.match(/^Key events,([^\n]+)/m);
  if (totalUsersMatch) {
    const parseNum = (s: string) => {
      const n = Number(s.replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    };
    const rateRaw = rateMatch?.[1]?.trim() ?? "0";
    const rateNum = parseFloat(rateRaw.replace("%", ""));
    totals = {
      label: "Period total",
      totalUsers: parseNum(totalUsersMatch[1] ?? "0"),
      newUsers: parseNum(newUsersMatch?.[1] ?? "0"),
      userKeyEventRate: Number.isFinite(rateNum) ? (rateRaw.includes("%") ? rateNum / 100 : rateNum) : 0,
      keyEvents: parseNum(keyEventsMatch?.[1] ?? "0"),
    };
  }
  return { months, totals };
}

const TABLE_MARKER = "### Organic users by month (GA4)";

export function buildGaOrganicUsersByMonthMarkdownTable(csvContent: string): string {
  const { months, totals } = parseGaOrganicUsersByMonthCsv(csvContent);
  if (months.length === 0) return "";

  const orderedMonths = sortByMonthLabel(months, (r) => r.label);

  const header =
    "| Month | Total users | New users | User key event rate | Key events |";
  const sep = "| --- | ---: | ---: | ---: | ---: |";
  const body = orderedMonths
    .map(
      (r) =>
        `| ${r.label} | ${formatCanadianNumber(r.totalUsers)} | ${formatCanadianNumber(r.newUsers)} | ${gaUserKeyEventRateDisplay(r.userKeyEventRate)} | ${formatCanadianNumber(r.keyEvents)} |`,
    )
    .join("\n");

  const totalRow =
    totals != null
      ? `| **Period total** | ${formatCanadianNumber(totals.totalUsers)} | ${formatCanadianNumber(totals.newUsers)} | ${gaUserKeyEventRateDisplay(totals.userKeyEventRate)} | ${formatCanadianNumber(totals.keyEvents)} |`
      : "";

  const footnote =
    totals != null
      ? "Note: As more reporting periods are collected, historical period comparisons will become available. Until then, totals and each month stand on their own."
      : "";

  const tableLines = [header, sep, body, totalRow].filter(Boolean).join("\n");

  const parts = [
    TABLE_MARKER,
    "_First user medium: organic only. Website traffic from GA4, not Search Console._",
    "",
    tableLines,
  ];
  if (footnote) {
    parts.push("", footnote);
  }
  return parts.join("\n");
}

export { TABLE_MARKER as GA_ORGANIC_USERS_BY_MONTH_TABLE_MARKER };
