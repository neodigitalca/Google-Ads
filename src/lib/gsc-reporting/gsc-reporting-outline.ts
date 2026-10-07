import { callGscReportingOpenRouterChatCompletion } from "@/lib/gsc-reporting/gsc-reporting-openrouter";
import { buildOpenRouterChatPostBodyJson } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import {
  bundleGscOutlineFilesForPrompt,
} from "@/lib/gsc-reporting/gsc-reporting-outline-bundle";
import {
  type GscManualAiPayload,
  type GscManualAiTopRow,
} from "@/lib/gsc-manual-ai-aggregate";
import type { GscReportingOutlineResult, GscReportingSectionKind, GscReportingSectionPlan } from "@/lib/gsc-reporting/gsc-reporting-types";
import {
  gscOutlineMaxOutputTokensForModel,
  GSC_OUTLINE_OPENROUTER_OPTS,
  GSC_OUTLINE_OUTPUT_LIMITS,
} from "@/lib/gsc-reporting/gsc-reporting-outline-schema";
import {
  searchPerformanceH2ForCompareKind,
  type GscCompareKind,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { seedHasGaTrafficAcquisitionFile } from "@/lib/gsc-reporting/gsc-reporting-fetch";
import {
  applyReportPeriodToClientSeason,
  emptyGscClientSeasonContext,
  formatGscClientSeasonPromptBlock,
  type GscClientSeasonContext,
} from "@/lib/gsc-reporting/gsc-reporting-client-season";
import { formatGscReportTitlePeriod } from "@/lib/gsc-reporting/gsc-reporting-document-title";
import { REPORTING_ENGLISH_PROSE_RULES } from "@/lib/reporting/reporting-english-prose";

/** Fail fast when OpenRouter outline hangs (PHP allows up to 300s). */
export const GSC_OUTLINE_OPENROUTER_TIMEOUT_MS = 120_000;

function outlineAbortSignal(userSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(GSC_OUTLINE_OPENROUTER_TIMEOUT_MS);
  if (!userSignal) return timeoutSignal;
  return AbortSignal.any([userSignal, timeoutSignal]);
}

/** Blog-style Title Case H2s; no calendar ranges in headings (periods stay in tables / CSV). */
const CANONICAL_H2_BY_KIND: Partial<Record<GscReportingSectionKind, string>> = {
  executive_summary: "Executive Summary",
  website_traffic_acquisition: "Website Traffic From Organic Search",
  search_performance_period: "Search Performance Compared Month Over Month",
  key_performance_insights: "Key Performance Insights for the Team",
  sap_local_seo: "SAP & Local SEO Performance",
  content_performance: "Content Performance: Your Growing Digital Footprint",
};

/** Overwrite model-provided h2Title for standard sections so titles stay consistent. Cluster sections keep their titles. */
export function applyCanonicalGscSectionTitles(
  sections: GscReportingSectionPlan[],
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  const searchPerformanceH2 = searchPerformanceH2ForCompareKind(compareKind);
  return sections.map((s) => {
    if (s.kind === "cluster") return s;
    if (s.kind === "search_performance_period") {
      return { ...s, h2Title: searchPerformanceH2 };
    }
    const h2 = CANONICAL_H2_BY_KIND[s.kind];
    return h2 ? { ...s, h2Title: h2 } : s;
  });
}

const OUTLINE_JSON_CONTRACT = `Return **one JSON object only** (no markdown fences, no prose before or after). Keys: **executiveSummary** (string), **topOpportunities** (array, max **${GSC_OUTLINE_OUTPUT_LIMITS.topOpportunitiesMax}** items).

**Size caps:** executiveSummary ≤ **${GSC_OUTLINE_OUTPUT_LIMITS.executiveSummaryMaxChars}** characters. Each opportunity: **rank**, **label**, **why**, **metrics**, **evidence** (array, 0–${GSC_OUTLINE_OUTPUT_LIMITS.evidenceMaxItems} strings).

**JSON safety (mandatory):** Inside string values do **not** use the ASCII double-quote character. Do **not** use line breaks inside strings. Use apostrophes for possessives if needed.

Example shape (fill with real CSV data):
{"executiveSummary":"…","topOpportunities":[{"rank":1,"label":"Branded visibility","why":"…","metrics":"…","evidence":["…"]}]}`;

const OUTLINE_COMPARE_SYSTEM = `You are an SEO analyst. The user provides Google Search Console CSV exports and may include GA4 Organic Search traffic acquisition CSV.

${REPORTING_ENGLISH_PROSE_RULES}

${OUTLINE_JSON_CONTRACT}

**Source-of-truth split (when GA Organic Search CSV is present):** **GA4** = **website organic traffic** (sessions, engaged sessions, engagement). **GSC** = **search visibility** (clicks, impressions, queries, CTR, average position). **Never** describe GSC click or impression changes as **organic traffic**, **website traffic**, or **sessions**.

**executiveSummary** MUST name the **REPORT_PERIOD** date range when referring to the current window, and include **exactly one sentence** that uses the word **seasonality** and says **busy** or **not busy** for this city and vertical across the **full REPORT_PERIOD** from **CLIENT_SEASON** (not only the first month; not today's calendar month). Do **not** say **shoulder**, **peak**, or **slow**. Do **not** repeat that seasonality reading elsewhere. Do not invent metrics. Do not invent a city. Keep **executiveSummary** under **${GSC_OUTLINE_OUTPUT_LIMITS.executiveSummaryMaxChars} characters**.

When **GA-Organic-Search-Traffic-Acquisition-MoM.csv** is in the upload, **executiveSummary** must **open the website-traffic story** with **Organic sessions** (period A vs B and MoM % from that file) before any GSC visibility metrics. GSC clicks/impressions belong to **search visibility**, not traffic.

Data rules:
- Numbers in executiveSummary, metrics, and evidence must come from the CSV text (GA file for session/engagement figures; GSC files for search metrics).
- **Site-totals-MoM.csv** includes **Search queries** (total query count per period) as a standard site-wide KPI alongside clicks, impressions, CTR, and position.
- When **Site-totals-compare-signals.txt** is present, **executiveSummary** must align with \`primaryPattern\` and \`interpretation\` from that block. **Never** describe **query_footprint_expansion** months as overall search visibility decline.
- When **Query-spotlight-narrative.txt** lists queries, prefer those in **topOpportunities** and copy the spirit of each \`interpretation\` (impression growth before position dilution). Obey each \`forbiddenFraming\` line.
- **Cross-metric rule (any period compare):** Do **not** infer visibility loss from average position alone when **Search queries** and **Total impressions** both rose vs the prior period.
- **executiveSummary** must be **factual synthesis** with numbers from the CSV only; keep it **thematic**. Do **not** output prioritized action lists, next steps, or tactical blocks.
- topOpportunities: at most **${GSC_OUTLINE_OUTPUT_LIMITS.topOpportunitiesMax}** rows; rank by business impact and merge near-duplicates.
- evidence: **0–${GSC_OUTLINE_OUTPUT_LIMITS.evidenceMaxItems}** strings per row (optional).`;

const OUTLINE_PERIOD_PROGRESS_SYSTEM = `You are an SEO analyst. This is a **period progress** report for **REPORT_PERIOD** only (not a two-period compare report).

${REPORTING_ENGLISH_PROSE_RULES}

${OUTLINE_JSON_CONTRACT}

**Source split:** **GA-Organic-Search-Traffic-Acquisition-By-Month.csv** (when present) = **website traffic** (**Organic Search sessions**, GA4 Traffic acquisition). **GSC** = **search visibility** only (queries, named pages). Never call GSC clicks traffic or sessions. **Never** plan or describe a **Site search totals** GSC table (by month or otherwise); period progress reports show GA traffic in **Website Traffic From Organic Search** and query visibility under **Search Performance This Period** only.

**executiveSummary:** When GA CSV is present, open with **period total Organic Search sessions** for **REPORT_PERIOD** (totals block in CSV). State months as **facts only** (no increase/decrease). One **seasonality** sentence from **CLIENT_SEASON**. Do **not** use **progress** or vs-prior-period framing. Keep **executiveSummary** under **${GSC_OUTLINE_OUTPUT_LIMITS.executiveSummaryMaxChars} characters**.

Data rules:
- Numbers must come from the CSV text only.
- Prefer **Queries-Period.csv** / **Pages-Period.csv** for opportunities.
- No prioritized action lists or next steps in executiveSummary.
- topOpportunities: at most **${GSC_OUTLINE_OUTPUT_LIMITS.topOpportunitiesMax}** rows.
- evidence: **0–${GSC_OUTLINE_OUTPUT_LIMITS.evidenceMaxItems}** strings per row (optional).`;

function outlineSystemForCompareKind(compareKind: GscCompareKind): string {
  return compareKind === "period_progress" ? OUTLINE_PERIOD_PROGRESS_SYSTEM : OUTLINE_COMPARE_SYSTEM;
}

export function defaultSectionsFromPayload(
  p: GscManualAiPayload,
  compareKind: GscCompareKind = "mom",
  options?: { includeGaTraffic?: boolean },
): GscReportingSectionPlan[] {
  void p;
  const includeGaTraffic = options?.includeGaTraffic === true;
  const sections: GscReportingSectionPlan[] = [
    {
      id: "executive_summary",
      h2Title: "",
      kind: "executive_summary",
      ragQuery: "executive summary clicks impressions ctr position trends branded",
    },
  ];
  if (includeGaTraffic) {
    sections.push({
      id: "website_traffic_acquisition",
      h2Title: "",
      kind: "website_traffic_acquisition",
      ragQuery:
        "organic sessions engaged sessions engagement rate key events events per session GA traffic acquisition",
    });
  }
  sections.push(
    {
      id: "search_performance_period",
      h2Title: "",
      kind: "search_performance_period",
      ragQuery: "search performance impressions clicks period comparison month",
    },
    {
      id: "content_performance",
      h2Title: "",
      kind: "content_performance",
      ragQuery: "pages urls sitemap post blog product location local service-area landing impressions clicks position",
    },
    {
      id: "sap_local_seo",
      h2Title: "",
      kind: "sap_local_seo",
      ragQuery: "entity sitemap xml location place local business page url impressions clicks position comparison",
    },
  );
  return applyCanonicalGscSectionTitles(sections, compareKind);
}

/** Drop legacy generative_ai_impressions sections (GSC API has no programmatic Generative AI report yet). */
export function stripGenerativeAiSections(
  sections: GscReportingSectionPlan[],
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  return applyCanonicalGscSectionTitles(
    sections.filter((s) => (s.kind as string) !== "generative_ai_impressions"),
    compareKind,
  );
}

/** Keep website_traffic_acquisition only when GA CSV is present; insert after executive_summary when missing. */
export function applyGaTrafficSectionGate(
  sections: GscReportingSectionPlan[],
  includeGaTraffic: boolean,
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  const withoutGa = sections.filter((s) => s.kind !== "website_traffic_acquisition");
  if (!includeGaTraffic) {
    return applyCanonicalGscSectionTitles(withoutGa, compareKind);
  }
  const gaSection: GscReportingSectionPlan = {
    id: "website_traffic_acquisition",
    h2Title: "Website Traffic From Organic Search",
    kind: "website_traffic_acquisition",
    ragQuery:
      "organic sessions engaged sessions engagement rate key events events per session GA traffic acquisition",
  };
  const execIdx = withoutGa.findIndex((s) => s.kind === "executive_summary");
  const insertAt = execIdx >= 0 ? execIdx + 1 : 0;
  const next = [...withoutGa.slice(0, insertAt), gaSection, ...withoutGa.slice(insertAt)];
  return applyCanonicalGscSectionTitles(next, compareKind);
}

/** Drop seasonal_demand. Season is one sentence in Executive Summary only. */
export function applySeasonalDemandSectionGate(
  sections: GscReportingSectionPlan[],
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  return applyCanonicalGscSectionTitles(
    sections.filter((s) => s.kind !== "seasonal_demand"),
    compareKind,
  );
}

/** Key insights live under Executive Summary only; no separate Key Performance Insights section. */
export function applyKeyPerformanceInsightsSectionGate(
  sections: GscReportingSectionPlan[],
  compareKind: GscCompareKind = "mom",
): GscReportingSectionPlan[] {
  return applyCanonicalGscSectionTitles(
    sections.filter((s) => s.kind !== "key_performance_insights"),
    compareKind,
  );
}

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.trim().length > 0;
}

function parseOutlineTopOpportunities(raw: unknown): GscManualAiTopRow[] {
  if (!Array.isArray(raw)) return [];
  const out: GscManualAiTopRow[] = [];
  for (let i = 0; i < raw.length && out.length < GSC_OUTLINE_OUTPUT_LIMITS.topOpportunitiesMax; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const rank = typeof r.rank === "number" ? r.rank : Number(r.rank);
    if (!Number.isFinite(rank)) continue;
    if (!isNonEmptyString(r.label) || !isNonEmptyString(r.why) || !isNonEmptyString(r.metrics)) continue;
    const evidence = Array.isArray(r.evidence)
      ? r.evidence.filter(isNonEmptyString).map((line) => String(line).trim()).slice(0, GSC_OUTLINE_OUTPUT_LIMITS.evidenceMaxItems)
      : [];
    out.push({
      rank,
      label: r.label.trim(),
      why: r.why.trim(),
      metrics: r.metrics.trim(),
      evidence: evidence.length > 0 ? evidence : undefined,
    });
  }
  return out;
}

function parseOutlineBasePayload(parsed: Record<string, unknown>): GscManualAiPayload {
  if (!isNonEmptyString(parsed.executiveSummary)) {
    throw new Error("AI JSON missing executiveSummary.");
  }
  return {
    executiveSummary: parsed.executiveSummary.trim(),
    topOpportunities: parseOutlineTopOpportunities(parsed.topOpportunities),
    clusters: [],
  };
}

function outlineJsonTextFromModel(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/m, "").trim();
  }
  return t;
}

function openRouterMessageParsedObject(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const choices = (raw as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const parsed = (message as { parsed?: unknown }).parsed;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}

function parseOutlineModelJsonObject(content: string, raw?: unknown): Record<string, unknown> {
  const fromMessage = openRouterMessageParsedObject(raw);
  if (fromMessage) {
    return fromMessage;
  }
  const jsonText = outlineJsonTextFromModel(content.trim());
  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    throw new Error(
      "OpenRouter outline response was not valid JSON. Use a model that supports JSON output.",
    );
  }
}

export function parseGscReportingOutlineJsonFromRecord(
  parsed: Record<string, unknown>,
  compareKind: GscCompareKind = "mom",
  options?: { includeGaTraffic?: boolean },
): GscReportingOutlineResult {
  const base = parseOutlineBasePayload(parsed);
  const includeGaTraffic = options?.includeGaTraffic === true;
  let sections = defaultSectionsFromPayload(base, compareKind, { includeGaTraffic });
  sections = stripGenerativeAiSections(sections, compareKind);
  sections = applyGaTrafficSectionGate(sections, includeGaTraffic, compareKind);
  sections = applySeasonalDemandSectionGate(sections, compareKind);
  sections = applyKeyPerformanceInsightsSectionGate(sections, compareKind);
  return {
    ...base,
    clusters: [],
    sections,
  };
}

export function parseGscReportingOutlineJson(
  raw: string,
  compareKind: GscCompareKind = "mom",
  options?: { includeGaTraffic?: boolean },
): GscReportingOutlineResult {
  const parsed = parseOutlineModelJsonObject(raw);
  return parseGscReportingOutlineJsonFromRecord(parsed, compareKind, options);
}

export async function runGscReportingOutline(args: {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  files: { name: string; content: string }[];
  compareKind?: GscCompareKind;
  compareLabel?: string;
  clientSeason?: GscClientSeasonContext | null;
  signal?: AbortSignal;
}): Promise<{
  outline: GscReportingOutlineResult;
  truncatedInput: boolean;
  filenames: string[];
  outlineRequestBodyJson: string;
}> {
  const compareKind = args.compareKind ?? "mom";
  const includeGaTraffic = seedHasGaTrafficAcquisitionFile(args.files);
  const { text, truncated, filenames } = bundleGscOutlineFilesForPrompt(args.files, compareKind);
  const outlineSystem = outlineSystemForCompareKind(compareKind);
  const gaTrafficHint = includeGaTraffic
    ? compareKind === "period_progress"
      ? "\nGA-Organic-Search-Traffic-Acquisition-By-Month.csv IS present (GA4 Traffic acquisition, Organic Search channel). The app adds **Website Traffic From Organic Search** with the **Organic Search traffic acquisition** table by month. **executiveSummary** must lead with **period total Organic Search sessions** from that file. GSC is search visibility only."
      : "\nGA4 Organic Search traffic acquisition CSV IS present. The app will add a Website Traffic From Organic Search section. **executiveSummary must lead with GA Organic sessions MoM** for website traffic. Use GSC only for search visibility (clicks, impressions, queries). Do not call GSC click drops organic traffic."
    : "";
  const periodProgressHint =
    compareKind === "period_progress"
      ? `\nThis is a **period progress** report. **GA-Organic-Search-Traffic-Acquisition-By-Month.csv** (when present) = **Organic Search sessions** for executiveSummary. **GSC** = **search visibility** only. Do not call GSC clicks traffic or sessions. Do not use progress or vs-prior-period framing in client-facing copy.`
      : "";
  const compareLabel = args.compareLabel?.trim() ?? "";
  const reportPeriod = formatGscReportTitlePeriod(compareLabel);
  const season = applyReportPeriodToClientSeason(args.clientSeason ?? emptyGscClientSeasonContext(), compareLabel);
  const reportPeriodBlock = reportPeriod
    ? `\nREPORT_PERIOD (current GSC window from the date picker; name this exact range when you mention the period): ${reportPeriod}\n`
    : "";
  const userMessage = `Site: ${args.siteName} (${args.siteUrl})
${gaTrafficHint}${periodProgressHint}
${reportPeriodBlock}
${formatGscClientSeasonPromptBlock(season)}

Below are the CSV file contents. Analyze and produce the JSON object as specified.

${text}`;

  const maxTokens = gscOutlineMaxOutputTokensForModel(args.model);
  const outlineRequestBodyJson = buildOpenRouterChatPostBodyJson({
    model: args.model,
    maxTokensRequested: maxTokens,
    system: outlineSystem,
    userMessage,
    ...GSC_OUTLINE_OPENROUTER_OPTS,
  });

  const completion = await callGscReportingOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: outlineSystem,
    user: userMessage,
    maxTokens,
    signal: outlineAbortSignal(args.signal),
    ...GSC_OUTLINE_OPENROUTER_OPTS,
  });

  const parsed =
    completion.parsed && typeof completion.parsed === "object" && !Array.isArray(completion.parsed)
      ? (completion.parsed as Record<string, unknown>)
      : parseOutlineModelJsonObject(completion.content, completion.raw);
  const outline = parseGscReportingOutlineJsonFromRecord(parsed, compareKind, {
    includeGaTraffic,
  });
  return { outline, truncatedInput: truncated, filenames, outlineRequestBodyJson };
}
