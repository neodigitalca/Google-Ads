/**
 * Smaller CSV bundle for the GSC outline LLM step (executiveSummary + topOpportunities only).
 * Full files stay in the pipeline for per-section RAG; outline does not need indexed URL inventories.
 */
import { bundleGscManualFilesForPrompt } from "@/lib/gsc-manual-ai-aggregate";
import {
  GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME,
  GA_ORGANIC_TRAFFIC_ACQUISITION_MOM_FILENAME,
} from "@/lib/gsc-reporting/gsc-reporting-fetch";
import {
  GSC_PAGES_PERIOD_FILENAME,
  GSC_QUERIES_PERIOD_FILENAME,
  GSC_SITE_TOTALS_BY_MONTH_FILENAME,
} from "@/lib/gsc-reporting/gsc-reporting-monthly-totals";
import type { GscCompareKind } from "@/lib/gsc-reporting/gsc-reporting-compare-signals";

/** Outline reads site totals, compare signals, sitemap names, and top query/page rows only. */

const OUTLINE_COMPARE_ALWAYS_FILES = new Set([
  "Site-totals-MoM.csv",
  "Site-totals-compare-signals.txt",
  "GSC-sitemaps.csv",
  GA_ORGANIC_TRAFFIC_ACQUISITION_MOM_FILENAME,
]);

const OUTLINE_PERIOD_PROGRESS_ALWAYS_FILES = new Set([
  GSC_SITE_TOTALS_BY_MONTH_FILENAME,
  GSC_QUERIES_PERIOD_FILENAME,
  GSC_PAGES_PERIOD_FILENAME,
  "GSC-sitemaps.csv",
  GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME,
]);

const OUTLINE_CAPPED_CSV_FILES = new Set([
  "Queries-MoM.csv",
  "Pages-MoM.csv",
  "Queries-YoY.csv",
  "Pages-YoY.csv",
  GSC_QUERIES_PERIOD_FILENAME,
  GSC_PAGES_PERIOD_FILENAME,
]);

function isPeriodProgressOutline(files: { name: string }[], compareKind?: GscCompareKind): boolean {
  if (compareKind === "period_progress") return true;
  const names = new Set(files.map((f) => f.name.trim()));
  return names.has(GSC_SITE_TOTALS_BY_MONTH_FILENAME) && !names.has("Site-totals-MoM.csv");
}

export function selectGscOutlineSourceFiles(
  files: { name: string; content: string }[],
  compareKind?: GscCompareKind,
): { name: string; content: string }[] {
  const periodProgress = isPeriodProgressOutline(files, compareKind);
  const alwaysFiles = periodProgress ? OUTLINE_PERIOD_PROGRESS_ALWAYS_FILES : OUTLINE_COMPARE_ALWAYS_FILES;
  const compareOnlyOutlineFiles = new Set([
    "Site-totals-MoM.csv",
    "Site-totals-compare-signals.txt",
    "Queries-MoM.csv",
    "Pages-MoM.csv",
    "Queries-YoY.csv",
    "Pages-YoY.csv",
    GA_ORGANIC_TRAFFIC_ACQUISITION_MOM_FILENAME,
  ]);
  const out: { name: string; content: string }[] = [];
  for (const file of files) {
    const name = file.name.trim();
    if (!name || !file.content.trim()) continue;
    if (periodProgress && compareOnlyOutlineFiles.has(name)) continue;
    if (alwaysFiles.has(name)) {
      out.push(file);
      continue;
    }
    if (OUTLINE_CAPPED_CSV_FILES.has(name)) {
      out.push(file);
      continue;
    }
    if (name.startsWith("Indexed-pages-urls")) continue;
    if (name.includes("GenerativeAI")) out.push(file);
  }
  return out.length > 0 ? out : files.filter((f) => f.content.trim());
}

export function bundleGscOutlineFilesForPrompt(
  files: { name: string; content: string }[],
  compareKind?: GscCompareKind,
): {
  text: string;
  truncated: boolean;
  filenames: string[];
} {
  const selected = selectGscOutlineSourceFiles(files, compareKind);
  return bundleGscManualFilesForPrompt(selected);
}
