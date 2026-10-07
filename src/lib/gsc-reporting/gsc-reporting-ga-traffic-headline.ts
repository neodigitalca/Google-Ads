import {
  GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME,
  GA_ORGANIC_TRAFFIC_ACQUISITION_MOM_FILENAME,
  isGaTrafficReportingFile,
  isValidGaOrganicReportingFileContent,
} from "@/lib/gsc-reporting/gsc-reporting-fetch";
import { formatCanadianNumber } from "@/lib/gsc-reporting/gsc-number-format";
import { parseGaOrganicTrafficAcquisitionByMonthCsv } from "@/lib/gsc-reporting/gsc-reporting-ga-acquisition-monthly";
import { parseGaOrganicTrafficAcquisitionMomCsv } from "@/lib/gsc-reporting/gsc-reporting-ga-organic-table";
import type { GscCompareKind } from "@/lib/gsc-reporting/gsc-reporting-compare-signals";

export const GA_TRAFFIC_EXECUTIVE_PIN_SOURCE = "__GA4_WEBSITE_TRAFFIC__";

function organicSessionsRow(rows: ReturnType<typeof parseGaOrganicTrafficAcquisitionMomCsv>) {
  return rows.find((r) => r.metric.trim().toLowerCase() === "organic sessions");
}

/** Deterministic GA4 traffic facts for Executive Summary (all clients, same contract). */
export function buildGaTrafficExecutivePinText(args: {
  files: { name: string; content: string }[];
  compareKind: GscCompareKind;
}): string {
  const gaFile = args.files.find(
    (f) => isGaTrafficReportingFile(f.name) && isValidGaOrganicReportingFileContent(f.name, f.content),
  );
  if (!gaFile) {
    return [
      "--- BLOCK: GA4_WEBSITE_TRAFFIC ---",
      "GA4 organic traffic CSV missing. Do not invent traffic or session counts.",
    ].join("\n");
  }

  const lines: string[] = [
    "--- BLOCK: GA4_WEBSITE_TRAFFIC (mandatory) ---",
    "Source of truth for **website traffic**: GA4 Organic Search only.",
    "Source of truth for **keywords / search visibility**: Google Search Console only.",
    "FORBIDDEN in the Executive Summary traffic sentence: GSC clicks, GSC impressions, or phrases like organic search clicks as traffic.",
  ];

  if (gaFile.name.trim() === GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME) {
    const { totals } = parseGaOrganicTrafficAcquisitionByMonthCsv(gaFile.content);
    if (totals) {
      lines.push(
        `Period total Organic Search sessions (GA4 Traffic acquisition): ${formatCanadianNumber(totals.sessions)}.`,
        `Period engaged sessions (GA4): ${formatCanadianNumber(totals.engagedSessions)}.`,
        `Period key events (GA4): ${formatCanadianNumber(totals.keyEvents)}.`,
      );
      if (args.compareKind === "period_progress") {
        lines.push(
          "Executive Summary: second sentence must state **Organic Search sessions** for the full period using the GA figure above (not GSC clicks).",
        );
      }
    }
  } else if (gaFile.name.trim() === GA_ORGANIC_TRAFFIC_ACQUISITION_MOM_FILENAME) {
    const rows = parseGaOrganicTrafficAcquisitionMomCsv(gaFile.content);
    const sessions = organicSessionsRow(rows);
    if (sessions) {
      lines.push(
        `Organic sessions period A (GA4): ${sessions.periodA}.`,
        `Organic sessions period B (GA4): ${sessions.periodB}.`,
        `Organic sessions MoM % (GA4): ${sessions.momPct}.`,
        "Executive Summary: second sentence must state **Organic sessions** and MoM % using these GA figures (not GSC clicks).",
      );
    }
  }

  return lines.join("\n");
}
