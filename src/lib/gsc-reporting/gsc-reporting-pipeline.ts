import { callGscReportingOpenRouterChatCompletion } from "@/lib/gsc-reporting/gsc-reporting-openrouter";
import {
  buildOpenRouterChatPostBodyJson,
  getCompetitorReportMaxOutputTokens,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { sanitizeStrategistMarkdownSection } from "@/lib/competitor-research/competitor-report-markdown-sanitize";
import { AGENCY_NAME } from "@/lib/report-planner";
import {
  mergePinnedChunksWithRetrieval,
  pickFirstChunkPerSourceFile,
  retrieveTopChunks,
  splitGscFilesIntoChunks,
} from "@/lib/gsc-reporting/gsc-reporting-chunks";
import {
  buildSapEntityAllowlistChunkText,
  buildSapFilteredPagesChunkText,
  isPagesMomReportingFile,
} from "@/lib/gsc-reporting/gsc-reporting-sap-entity-context";
import { stripGenerativeAiSections } from "@/lib/gsc-reporting/gsc-reporting-outline";
import {
  bundleHasValidGaOrganicTrafficData,
  isGaTrafficReportingFile,
} from "@/lib/gsc-reporting/gsc-reporting-fetch";
import {
  buildGaTrafficExecutivePinText,
  GA_TRAFFIC_EXECUTIVE_PIN_SOURCE,
} from "@/lib/gsc-reporting/gsc-reporting-ga-traffic-headline";
import { applyGaTrafficSectionGate } from "@/lib/gsc-reporting/gsc-reporting-outline";
import {
  buildCompareSignalsPinChunk,
  COMPARE_SIGNALS_SECTION_KINDS,
  ensureCompareSignalsFile,
  QUERY_SPOTLIGHT_SECTION_KINDS,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { buildQuerySpotlightPinChunk } from "@/lib/gsc-reporting/gsc-query-spotlight";
import {
  organicTrafficTableFromBundledFiles,
  spliceOrganicTrafficAcquisitionTableIntoMarkdown,
} from "@/lib/gsc-reporting/gsc-reporting-ga-organic-table";
import { assembleSearchPerformanceSectionBody } from "@/lib/gsc-reporting/gsc-reporting-search-performance-layout";
import {
  siteTotalsTableFromBundledFiles,
  spliceGscSiteTotalsIntoSearchPerformance,
} from "@/lib/gsc-reporting/gsc-reporting-site-totals-table";
import { sapEntityPagesTableFromBundledFiles } from "@/lib/gsc-reporting/gsc-reporting-sap-pages-table";
import { topQueriesTableFromBundledFiles } from "@/lib/gsc-reporting/gsc-reporting-top-queries-table";
import { runGscReportingOutline } from "@/lib/gsc-reporting/gsc-reporting-outline";
import {
  applyGscReportingFinalMarkdownPost,
  applyGscReportingMarkdownPost,
} from "@/lib/gsc-reporting/gsc-reporting-markdown-post";
import {
  buildUserMessageForSection,
  getGscReportingSectionSystemPrompt,
} from "@/lib/gsc-reporting/gsc-reporting-section-prompts";
import type {
  GscReportingChunk,
  GscReportingPipelineResult,
  GscReportingSectionResult,
  RunGscReportingPipelineArgs,
} from "@/lib/gsc-reporting/gsc-reporting-types";
import * as gscProgressLog from "@/lib/gsc-reporting/gsc-reporting-progress-log";
import { buildGscReportDocumentHeading } from "@/lib/gsc-reporting/gsc-reporting-document-title";
import { siteTotalsByMonthTableFromBundledFiles } from "@/lib/gsc-reporting/gsc-reporting-monthly-totals-table";
const RETRIEVAL_MAX_TOTAL_CHARS = 28_000;
const RETRIEVAL_MAX_CHUNKS = 12;
/** Executive summary allows more rows after per-file pins without raising the char budget. */
const RETRIEVAL_MAX_CHUNKS_EXEC_SUMMARY = 18;
/** Larger pool before merge so pins do not replace all lexical hits. */
const RETRIEVAL_SCORED_POOL_CHUNKS = 24;

const GSC_SITE_WIDE_CLICKS_FILES = new Set([
  "Site-totals-MoM.csv",
  "Site-totals-by-month.csv",
]);

function isGscSiteWideClicksSourceFile(sourceFile: string): boolean {
  return GSC_SITE_WIDE_CLICKS_FILES.has(sourceFile.trim());
}

function stripLeadingH2Duplicate(md: string, expectedTitle: string): string {
  const lines = md.split("\n");
  const first = lines[0]?.trim() ?? "";
  const want = `## ${expectedTitle}`.trim();
  if (first.toLowerCase() === want.toLowerCase()) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return md;
}

export async function runGscReportingPipeline(args: RunGscReportingPipelineArgs): Promise<GscReportingPipelineResult> {
  const {
    apiKey,
    model,
    siteName,
    siteUrl,
    files,
    sapEntityGrounding,
    compareKind = "mom",
    compareLabel = "",
    documentTitlePeriod = "",
    reportStructure = "compare",
    progressMonthCount = 0,
    clientSeason = null,
    signal,
    onProgress,
    onOutlineReady,
    onSectionStart,
    onSectionReady,
    priorSectionResults = [],
    savedOutline,
    savedOutlineRequestBodyJson,
  } = args;
  if (!apiKey.trim()) throw new Error("OpenRouter API key is required.");
  if (files.length === 0) throw new Error("No GSC data loaded.");

  const nonEmpty = files.filter((f) => f.content.trim().length > 0);
  if (nonEmpty.length === 0) throw new Error("All GSC files are empty.");

  const periodProgress = compareKind === "period_progress" || reportStructure === "period_progress";
  const bundledFiles =
    periodProgress || compareLabel.trim().length === 0
      ? nonEmpty
      : ensureCompareSignalsFile(nonEmpty, compareKind, compareLabel);

  const includeGaTraffic = bundleHasValidGaOrganicTrafficData(bundledFiles);
  if (!includeGaTraffic) {
    throw new Error(
      "GA4 organic traffic is required for SEO reporting. GA4 is website traffic; Search Console is keywords and visibility.",
    );
  }

  const savedOutlineMissingGaSection =
    Boolean(savedOutline) &&
    includeGaTraffic &&
    !savedOutline!.sections.some((s) => s.kind === "website_traffic_acquisition");

  const useSavedOutline = Boolean(savedOutline) && !savedOutlineMissingGaSection;

  const { outline: outlineRaw, truncatedInput, filenames, outlineRequestBodyJson } = useSavedOutline
    ? {
        outline: {
          ...savedOutline!,
          sections: stripGenerativeAiSections(
            applyGaTrafficSectionGate(savedOutline!.sections, includeGaTraffic, compareKind),
            compareKind,
          ),
        },
        truncatedInput: false,
        filenames: bundledFiles.map((f) => f.name),
        outlineRequestBodyJson: savedOutlineRequestBodyJson ?? "",
      }
    : await runGscReportingOutline({
        apiKey,
        model,
        siteName,
        siteUrl,
        files: bundledFiles,
        compareKind,
        compareLabel,
        clientSeason,
        signal,
      });

  const outline = {
    ...outlineRaw,
    sections: stripGenerativeAiSections(outlineRaw.sections, compareKind),
  };

  if (!savedOutline) {
    onOutlineReady?.({ outline, outlineRequestBodyJson });
  }

  const totalSteps = 1 + outline.sections.length;
  await onProgress?.({
    step: 1,
    total: totalSteps,
        label: gscProgressLog.formatGscOutlineCompleteLabel(outline.sections),
  });
  const chunks = splitGscFilesIntoChunks(bundledFiles);
  const compareSignalsPin = periodProgress ? null : buildCompareSignalsPinChunk(bundledFiles);
  const querySpotlightPin = periodProgress ? null : buildQuerySpotlightPinChunk(bundledFiles);
  const resumedSections = priorSectionResults.filter(
    (row) => (row.plan.kind as string) !== "generative_ai_impressions",
  );
  const priorByIndex = new Map(resumedSections.map((row) => [row.index, row]));
  const sectionResults: GscReportingSectionResult[] = [...resumedSections];

  const plans = outline.sections;
  const sectionTotal = plans.length;
  for (let i = 0; i < plans.length; i++) {
    const prior = priorByIndex.get(i);
    if (prior) {
      onSectionStart?.(i, prior.plan);
      await onProgress?.({
        step: 2 + i,
        total: totalSteps,
        label: gscProgressLog.formatGscSectionCompleteLabel(i, sectionTotal, prior.plan.h2Title),
        sectionIndex: i,
      });
      onSectionReady?.(prior);
      continue;
    }

    const plan = plans[i]!;
    onSectionStart?.(i, plan);

    const pinnedBase = pickFirstChunkPerSourceFile(chunks);
    let pinned: GscReportingChunk[] = pinnedBase;
    if (plan.kind === "website_traffic_acquisition") {
      pinned = pinnedBase.filter((c) => isGaTrafficReportingFile(c.sourceFile));
    } else if (plan.kind === "sap_local_seo" && sapEntityGrounding) {
      pinned = pinnedBase.filter((c) => !isPagesMomReportingFile(c.sourceFile));
    }

    const sapPins: GscReportingChunk[] =
      plan.kind === "sap_local_seo" && sapEntityGrounding
        ? [
            {
              id: "sap-entity-allowlist",
              sourceFile: "__SAP_ENTITY_ALLOWLIST__",
              text: buildSapEntityAllowlistChunkText(sapEntityGrounding),
            },
            {
              id: "sap-filtered-pages",
              sourceFile: "__SAP_FILTERED_PAGES__",
              text: buildSapFilteredPagesChunkText(sapEntityGrounding),
            },
          ]
        : [];

    const compareSignalPins: GscReportingChunk[] =
      compareSignalsPin && COMPARE_SIGNALS_SECTION_KINDS.has(plan.kind)
        ? [
            {
              id: compareSignalsPin.id,
              sourceFile: compareSignalsPin.sourceFile,
              text: compareSignalsPin.text,
            },
          ]
        : [];

    const querySpotlightPins: GscReportingChunk[] =
      querySpotlightPin && QUERY_SPOTLIGHT_SECTION_KINDS.has(plan.kind)
        ? [
            {
              id: querySpotlightPin.id,
              sourceFile: querySpotlightPin.sourceFile,
              text: querySpotlightPin.text,
            },
          ]
        : [];

    const gaExecutivePins: GscReportingChunk[] =
      plan.kind === "executive_summary" && includeGaTraffic
        ? [
            {
              id: "ga4-website-traffic-pin",
              sourceFile: GA_TRAFFIC_EXECUTIVE_PIN_SOURCE,
              text: buildGaTrafficExecutivePinText({
                files: bundledFiles,
                compareKind,
              }),
            },
            ...pinnedBase.filter((c) => isGaTrafficReportingFile(c.sourceFile)),
          ]
        : [];

    const pinnedMerged = [
      ...gaExecutivePins,
      ...compareSignalPins,
      ...querySpotlightPins,
      ...sapPins,
      ...pinned,
    ];

    const chunksForRag =
      plan.kind === "website_traffic_acquisition"
        ? chunks.filter((c) => isGaTrafficReportingFile(c.sourceFile))
        : plan.kind === "executive_summary"
          ? chunks.filter((c) => !isGscSiteWideClicksSourceFile(c.sourceFile))
          : plan.kind === "sap_local_seo" && sapEntityGrounding
            ? chunks.filter((c) => !isPagesMomReportingFile(c.sourceFile))
            : chunks;

    const scoredPool = retrieveTopChunks({
      chunks: chunksForRag,
      ragQuery: plan.ragQuery,
      h2Title: plan.h2Title,
      maxChunks: RETRIEVAL_SCORED_POOL_CHUNKS,
      maxTotalChars: RETRIEVAL_MAX_TOTAL_CHARS,
    });
    const retrievalChunkCap =
      plan.kind === "executive_summary" ? RETRIEVAL_MAX_CHUNKS_EXEC_SUMMARY : RETRIEVAL_MAX_CHUNKS;
    const retrieved = mergePinnedChunksWithRetrieval({
      pinned: pinnedMerged,
      scored: scoredPool,
      maxChunks: retrievalChunkCap,
      maxTotalChars: RETRIEVAL_MAX_TOTAL_CHARS,
    });
    const retrievedContext = retrieved.map((c) => c.text).join("\n\n---\n\n");

    let fixedTablesMarkdown: string | undefined;
    if (plan.kind === "sap_local_seo" && sapEntityGrounding) {
      const sapTable = sapEntityPagesTableFromBundledFiles(sapEntityGrounding, bundledFiles, {
        periodProgress,
      });
      if (sapTable.trim()) fixedTablesMarkdown = sapTable.trim();
    }
    const user = buildUserMessageForSection({
      siteName,
      siteUrl,
      outline,
      plan,
      retrievedContext,
      clientSeason,
      compareLabel,
      compareKind,
      fixedTablesMarkdown,
    });

    const system = getGscReportingSectionSystemPrompt(plan.kind, compareKind);
    const maxTokens = getCompetitorReportMaxOutputTokens(model);

    const requestBodyJson = buildOpenRouterChatPostBodyJson({
      model,
      maxTokensRequested: maxTokens,
      system,
      userMessage: user,
    });

    const { content } = await callGscReportingOpenRouterChatCompletion({
      apiKey,
      model,
      system,
      user,
      maxTokens,
      signal,
    });

    let body = sanitizeStrategistMarkdownSection(content.trim());
    body = stripLeadingH2Duplicate(body, plan.h2Title);
    body = applyGscReportingMarkdownPost(body, plan.kind);
    if (plan.kind === "search_performance_period") {
      const siteTotals = periodProgress
        ? ""
        : siteTotalsTableFromBundledFiles(bundledFiles, compareLabel);
      const topQueries = topQueriesTableFromBundledFiles(bundledFiles, compareLabel, {
        periodProgress,
      });
      const injectedTables = [siteTotals, topQueries].filter((t) => t.trim()).join("\n\n");
      body = assembleSearchPerformanceSectionBody({
        modelBody: body,
        injectedTables,
        includeInsightBullets: !periodProgress,
      });
    }
    const markdownBlock = `## ${plan.h2Title}\n\n${body.trim()}\n`;
    const row: GscReportingSectionResult = {
      plan,
      index: i,
      markdownBlock,
      requestBodyJson,
    };
    sectionResults.push(row);
    await onProgress?.({
      step: 2 + i,
      total: totalSteps,
      label: gscProgressLog.formatGscSectionCompleteLabel(i, sectionTotal, plan.h2Title),
      sectionIndex: i,
    });
    onSectionReady?.(row);
  }

  const title = [
    `# ${buildGscReportDocumentHeading(siteName, compareLabel, {
      reportStructure: periodProgress ? "period_progress" : "compare",
      monthCount: progressMonthCount > 0 ? progressMonthCount : undefined,
      documentTitlePeriod: documentTitlePeriod || undefined,
    })}`,
    "",
    AGENCY_NAME,
    `Prepared for: ${siteName}`,
    "",
  ].join("\n");
  const orderedSections = [...sectionResults].sort((a, b) => a.index - b.index);
  let markdown = [title, ...orderedSections.map((s) => s.markdownBlock)].join("\n");

  if (!periodProgress) {
    const siteTotalsTable = siteTotalsTableFromBundledFiles(bundledFiles, compareLabel);
    if (siteTotalsTable) {
      markdown = spliceGscSiteTotalsIntoSearchPerformance(markdown, siteTotalsTable);
    }
  }

  const organicTable = organicTrafficTableFromBundledFiles(bundledFiles, compareLabel);
  if (organicTable) {
    markdown = spliceOrganicTrafficAcquisitionTableIntoMarkdown(markdown, organicTable);
  }

  markdown = applyGscReportingFinalMarkdownPost(markdown);

  return {
    markdown,
    outline,
    truncatedInput,
    filenames,
    sectionResults: orderedSections,
    outlineRequestBodyJson,
  };
}
