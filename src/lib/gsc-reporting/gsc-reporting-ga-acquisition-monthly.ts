import type { GA4OrganicAcquisitionPeriod } from "@/components/integrations/types";
import { formatCanadianNumber, splitCsvLine } from "@/lib/gsc-reporting/gsc-number-format";
import { sortByMonthLabel } from "@/lib/gsc-reporting/gsc-reporting-table-sort";
import { gaUserKeyEventRateDisplay } from "@/lib/gsc-reporting/gsc-reporting-ga-organic-monthly";

export const GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME =
  "GA-Organic-Search-Traffic-Acquisition-By-Month.csv";

export type GA4OrganicTrafficAcquisitionMonthlyBlock = {
  channel: "Organic Search";
  dimension: "sessionDefaultChannelGroup";
  periodStart: string;
  periodEnd: string;
  totals: GA4OrganicAcquisitionPeriod;
  months: Array<
    {
      yearMonth: string;
      label: string;
    } & GA4OrganicAcquisitionPeriod
  >;
};

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function engagementRateCell(rate: number): string {
  if (!Number.isFinite(rate)) return " - ";
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(2)}%`;
}

function durationCell(sec: number): string {
  if (!Number.isFinite(sec)) return " - ";
  return `${Math.round(sec)}s`;
}

export function gaOrganicTrafficAcquisitionByMonthCsv(
  block: GA4OrganicTrafficAcquisitionMonthlyBlock,
): string {
  const lines: string[] = [
    `# GA4 Traffic acquisition: Organic Search (${block.periodStart} → ${block.periodEnd})`,
    "# Source: sessionDefaultChannelGroup = Organic Search (same as GA4 Traffic acquisition report).",
    "Month,Sessions,Engaged sessions,Engagement rate,Avg engagement time per session,Events per session,Event count,Key events",
  ];
  for (const row of block.months) {
    lines.push(
      [
        escapeCsvCell(row.label),
        escapeCsvCell(formatCanadianNumber(row.sessions)),
        escapeCsvCell(formatCanadianNumber(row.engagedSessions)),
        escapeCsvCell(engagementRateCell(row.engagementRate)),
        escapeCsvCell(durationCell(row.averageSessionDurationSec)),
        escapeCsvCell(formatCanadianNumber(row.eventsPerSession)),
        escapeCsvCell(formatCanadianNumber(row.eventCount)),
        escapeCsvCell(formatCanadianNumber(row.keyEvents)),
      ].join(","),
    );
  }
  const t = block.totals;
  lines.push(
    "",
    "# Period total (Organic Search channel, full report range)",
    "Metric,Value",
    `Sessions,${formatCanadianNumber(t.sessions)}`,
    `Engaged sessions,${formatCanadianNumber(t.engagedSessions)}`,
    `Engagement rate,${engagementRateCell(t.engagementRate)}`,
    `Average engagement time per session,${durationCell(t.averageSessionDurationSec)}`,
    `Events per session,${formatCanadianNumber(t.eventsPerSession)}`,
    `Event count,${formatCanadianNumber(t.eventCount)}`,
    `Key events,${formatCanadianNumber(t.keyEvents)}`,
  );
  return lines.join("\n");
}

export type GaAcquisitionMonthRow = { label: string } & GA4OrganicAcquisitionPeriod;

export function parseGaOrganicTrafficAcquisitionByMonthCsv(content: string): {
  months: GaAcquisitionMonthRow[];
  totals: GA4OrganicAcquisitionPeriod | null;
} {
  const months: GaAcquisitionMonthRow[] = [];
  const lines = content.split(/\r?\n/);
  let inTotals = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("Month,")) continue;
    if (t.startsWith("Metric,Value")) {
      inTotals = true;
      continue;
    }
    if (inTotals) continue;
    const parts = splitCsvLine(t);
    if (parts.length < 8) continue;
    const parseIntCell = (s: string) => {
      const n = Number(String(s).replace(/,/g, "").trim());
      return Number.isFinite(n) ? n : 0;
    };
    const rateRaw = parts[3]?.trim() ?? "";
    const rateNum = parseFloat(rateRaw.replace("%", ""));
    const avgRaw = parts[4]?.trim() ?? "0";
    const avgNum = parseFloat(String(avgRaw).replace(/s$/i, ""));
    months.push({
      label: parts[0]?.trim() ?? "",
      sessions: parseIntCell(parts[1] ?? "0"),
      engagedSessions: parseIntCell(parts[2] ?? "0"),
      engagementRate: Number.isFinite(rateNum) ? (rateRaw.includes("%") ? rateNum / 100 : rateNum) : 0,
      averageSessionDurationSec: Number.isFinite(avgNum) ? avgNum : 0,
      eventsPerSession: parseFloat(String(parts[5] ?? "0").replace(/,/g, "")) || 0,
      eventCount: parseIntCell(parts[6] ?? "0"),
      keyEvents: parseIntCell(parts[7] ?? "0"),
    });
  }
  const sessionsMatch = content.match(/^Sessions,([^\n]+)/m);
  if (!sessionsMatch) return { months, totals: null };
  const parseNum = (s: string) => {
    const n = Number(s.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  };
  const engagedMatch = content.match(/^Engaged sessions,([^\n]+)/m);
  const rateMatch = content.match(/^Engagement rate,([^\n]+)/m);
  const avgMatch = content.match(/^Average engagement time per session,([^\n]+)/m);
  const evPerMatch = content.match(/^Events per session,([^\n]+)/m);
  const evCountMatch = content.match(/^Event count,([^\n]+)/m);
  const keyMatch = content.match(/^Key events,([^\n]+)/m);
  const rateRaw = rateMatch?.[1]?.trim() ?? "0";
  const rateNum = parseFloat(rateRaw.replace("%", ""));
  const avgRaw = avgMatch?.[1]?.trim() ?? "0";
  const avgNum = parseFloat(String(avgRaw).replace(/s$/i, ""));
  return {
    months,
    totals: {
      sessions: parseNum(sessionsMatch[1] ?? "0"),
      engagedSessions: parseNum(engagedMatch?.[1] ?? "0"),
      engagementRate: Number.isFinite(rateNum) ? (rateRaw.includes("%") ? rateNum / 100 : rateNum) : 0,
      averageSessionDurationSec: Number.isFinite(avgNum) ? avgNum : 0,
      eventsPerSession: parseNum(evPerMatch?.[1] ?? "0"),
      eventCount: parseNum(evCountMatch?.[1] ?? "0"),
      keyEvents: parseNum(keyMatch?.[1] ?? "0"),
    },
  };
}

export const GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_TABLE_MARKER =
  "### Organic Search traffic acquisition";

export function buildGaOrganicTrafficAcquisitionByMonthMarkdownTable(csvContent: string): string {
  const { months, totals } = parseGaOrganicTrafficAcquisitionByMonthCsv(csvContent);
  if (months.length === 0) return "";

  const ordered = sortByMonthLabel(months, (r) => r.label);
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const header = line([
    "Month",
    "Sess",
    "Eng sess",
    "Eng rate",
    "Avg eng",
    "Ev/sess",
    "Events",
    "Key ev",
  ]);
  const sep = line(["---", "---:", "---:", "---:", "---:", "---:", "---:", "---:"]);
  const body = ordered.map((r) =>
    line([
      r.label,
      formatCanadianNumber(r.sessions),
      formatCanadianNumber(r.engagedSessions),
      engagementRateCell(r.engagementRate),
      durationCell(r.averageSessionDurationSec),
      formatCanadianNumber(r.eventsPerSession),
      formatCanadianNumber(r.eventCount),
      formatCanadianNumber(r.keyEvents),
    ]),
  );
  const totalRow =
    totals != null
      ? line([
          "**Period total**",
          formatCanadianNumber(totals.sessions),
          formatCanadianNumber(totals.engagedSessions),
          engagementRateCell(totals.engagementRate),
          durationCell(totals.averageSessionDurationSec),
          formatCanadianNumber(totals.eventsPerSession),
          formatCanadianNumber(totals.eventCount),
          formatCanadianNumber(totals.keyEvents),
        ])
      : "";

  return [
    GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_TABLE_MARKER,
    "",
    [header, sep, ...body, totalRow].filter(Boolean).join("\n"),
  ].join("\n");
}
