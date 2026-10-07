import { buildFocusedArticlePurpose } from "@/lib/content-generation/article-length-policy";
import { parseImportedLinksJson, parseImportedSectionsJson, parseModifierLinksJson } from "./bulk-csv-parser";
import { importedBodyH2Outline } from "./blog-import-parser";
import type { ImportedDraftLink } from "./blog-import-draft-links";
import type { ModifierExternalLink } from "./modifier-external-links";
import { formatPrefilledBulkRowContractFromCsvRow } from "./prefilled-bulk-row-contract";
import { autoSelectKeywords, autoSelectH2Sections, autoSelectPeopleAlsoAsk } from "./bulk-blueprint-generator";
import { generateSEOSlug } from "../seo-slug-generator";
import { fetchSemrushBulkEnrichment } from "../wordpress-api/semrush";
import type { SemrushBulkEnrichmentResult } from "../wordpress-api/semrush";
import type { IntelligentKeywordResearchMergeResult } from "./intelligent-keyword-research-merge";
import { buildSemrushKeywordsRagJson } from "../semrush-keywords-rag";
import { buildSemrushClusterScatterPlan, buildSemrushScatterContextJson } from "../semrush-cluster-scatter";
import { fetchSeoContentBriefWave } from "@/lib/llm-audit/fetch-seo-content-brief-wave";
import { mergeSeoBriefIntoBulkSkeleton } from "@/lib/llm-audit/fetch-merged-seo-content-brief";
import { llmAuditGuidanceFromBrief } from "@/lib/llm-audit/llm-audit-dataforseo";
import { resolveSiteLocationLabel } from "@/lib/llm-audit/resolve-site-location-label";
import type { SeoContentBriefV1 } from "@/lib/overview-seo-content-brief";
import { runTopicResearchFanout } from "@/lib/content-optimization/topic-research-fanout";
import { firstPartyAuthorityBlockFromBrief, swotTextFromResearchFields } from "@/lib/content-optimization/first-party-authority-prompt";
import { resolveLlmAuditAuthorityLinksForChecklist } from "@/lib/llm-audit/llm-audit-authority-links";
import { loadWorkflowSerpResearchBrief, parseSeoContentBriefFromRow } from "@/lib/workflow/workflow-serp-research-cache";
import { loadWorkflowDfsArticleAudit } from "@/lib/workflow/workflow-dfs-article-audit-cache";
import { formatDfsArticleAuditHarnessPromptBlock } from "@/lib/dfs-article-audit/format-dfs-article-audit-harness";
import { resolveSerpLocationName } from "@/lib/llm-audit/fetch-seo-content-brief-wave";
import type { BulkProcessingOptions, PrefetchedBulkKeywordResearch } from "./bulk-auto-generate-types";
import type { CSVRow } from "./bulk-csv-parser";
import { buildRowExplicitExternalAllowlist, externalUrlsFromPairs } from "../content-generation/external-link-placeholders";
import { researchModifierExternalLinks } from "./modifier-external-links";
import { buildBulkSelectedKeywordArtifactPayload } from "@/lib/bulk/bulk-keyword-research-artifacts";
import { buildSitesToPostFromPosting } from "@/lib/bulk/bulk-wordpress-link-prefetch";
import { getProductionModel, getResearchModel, getImageModel } from "../optimization-settings-storage";
import type { KeywordData, KeywordAIAnalysis } from "../keyword-types";
import { BulkFileManager, type BulkGeneratedFile } from "../bulk-file-manager";
import { emitEntitySapPipelineHarnessDone } from "@/lib/bulk/bulk-harness-progress";
import type { ExternalLinkPair } from "../content-generation/external-link-placeholders";
import type { LlmAuditAuthorityLinkLike } from "./modifier-external-links";

function bulkRowSerpLocationName(row: {
  title?: string;
  keyword?: string;
  modifier?: string;
  prompt_modifier?: string;
}): string {
  return resolveSerpLocationName("", [row.title, row.keyword, row.prompt_modifier, row.modifier].filter(Boolean).join(" "));
}

export type BulkRowResearchEnrichmentResult = {
  enrichedRow: CSVRow;
  aiAnalysis: KeywordAIAnalysis;
  semrushKeywordsContext?: string;
  semrushScatterContext?: string;
  rowExternalUrlsForSanitize: string[];
  semrushSnapshotForAcf?: SemrushBulkEnrichmentResult;
  semrushCitationForAcf: string | null;
  intelligentMergeForAcf: IntelligentKeywordResearchMergeResult | null;
  selectedKeywords: string[];
  selectedH2Sections: string[];
  selectedPeopleAlsoAsk: string[];
  importedDraftLinks: ImportedDraftLink[];
  importedH2Outline: string[];
  modifierExternalLinks: ModifierExternalLink[];
  rowExplicitExternalPairs: ExternalLinkPair[];
  prefilledRowContract: string;
  pipelineSiteId: string | undefined;
  pipelineResearchModel: string;
  pipelineBlogModel: string;
  pipelineImageModel: string;
  serpLlmBrief: SeoContentBriefV1;
  serpLlmBriefJson: string;
  serpStoredFile: string | null;
  llmOkCount: number;
  llmAuditSummaryPrompt: string;
  dfsArticleAuditBlock: string;
  firstPartyAuthorityBlock: string;
  llmAuditAuthorityLinks: LlmAuditAuthorityLinkLike[];
  selectedResearchLinks: string[];
  destinationPageUrl: string;
  entityForLocalTemplate: string | undefined;
  serpSite: import("@/components/integrations/types").WordPressSite | undefined;
};

export { bulkRowSerpLocationName };

export async function runBulkRowResearchEnrichmentPhase(input: {
  rowIndex: number;
  row: CSVRow;
  enrichedRow: CSVRow;
  keywordData: KeywordData;
  aiAnalysis: KeywordAIAnalysis;
  keywordsWithVolumeData: KeywordData[];
  paaRawResponse: unknown;
  options: BulkProcessingOptions;
  fileManager: BulkFileManager;
  timestamp: number;
  generatedFiles: BulkGeneratedFile[];
  connectedSite?: { name: string; siteUrl: string; id?: string };
  prefetchedResearch?: PrefetchedBulkKeywordResearch | null;
  entityForLocalTemplate: string | undefined;
  entityWikiUrl: string | undefined;
  entityWikiTitle: string | undefined;
}): Promise<BulkRowResearchEnrichmentResult> {
  const {
    rowIndex,
    row,
    enrichedRow: enrichedRowIn,
    keywordData,
    aiAnalysis,
    keywordsWithVolumeData,
    paaRawResponse,
    options,
    fileManager,
    timestamp,
    generatedFiles,
    connectedSite,
    prefetchedResearch,
    entityForLocalTemplate,
    entityWikiUrl,
    entityWikiTitle,
  } = input;

  let enrichedRow = enrichedRowIn;
  let semrushKeywordsContext: string | undefined;
  let semrushScatterContext: string | undefined;
  let rowExternalUrlsForSanitize: string[] = [];
  let semrushSnapshotForAcf: SemrushBulkEnrichmentResult | undefined;
  let semrushCitationForAcf: string | null = null;
  let intelligentMergeForAcf: IntelligentKeywordResearchMergeResult | null = null;


  let selectedKeywords: string[] = [];
  let selectedH2Sections: string[] = [];
  let selectedPeopleAlsoAsk: string[] = [];
  let importedDraftLinks: ImportedDraftLink[] = [];
  let importedH2Outline: string[] = [];
  let modifierExternalLinks: ModifierExternalLink[] = [];
  let rowExplicitExternalPairs: ExternalLinkPair[] = [];
  let prefilledRowContract = "";
  let pipelineSiteId: string | undefined;
  let pipelineResearchModel = "";
  let pipelineBlogModel = "";
  let pipelineImageModel = "";
  let serpLlmBrief!: SeoContentBriefV1;
  let serpLlmBriefJson = "";
  let serpStoredFile: string | null = null;
  let llmOkCount = 0;
  let llmAuditSummaryPrompt = "";
  let dfsArticleAuditBlock = "";
  let firstPartyAuthorityBlock = "";
  let llmAuditAuthorityLinks: LlmAuditAuthorityLinkLike[] = [];
  let selectedResearchLinks: string[] = [];
  let destinationPageUrl = "";
  let serpSite: import("@/components/integrations/types").WordPressSite | undefined;

  try {
    // CRITICAL FIX: Merge PAA questions from paaRawResponse into aiAnalysis
    // The AI analyzer returns empty peopleAlsoAsk because PAA is extracted separately
    // We need to populate it here so autoSelectPeopleAlsoAsk works correctly
    if (paaRawResponse?.tasks?.[0]?.result?.[0]?.items) {
      const paaItems = paaRawResponse.tasks[0].result[0].items;
      if (Array.isArray(paaItems) && paaItems.length > 0) {
        aiAnalysis.peopleAlsoAsk = paaItems
          .filter((item: any) => item.type === 'people_also_ask' && item.items)
          .flatMap((item: any) => item.items || [])
          .slice(0, 10)
          .map((item: any) => ({
            question: item.title || '',
            snippet: item.snippet || ''
          }))
          .filter((paa: any) => paa.question);
        console.log('[Bulk Auto-Generate] Merged PAA questions into aiAnalysis:', {
          paaItemsCount: paaItems.length,
          aiAnalysisPAACount: aiAnalysis.peopleAlsoAsk.length
        });
      }
    }

    // Semrush keyword enrichment (bulk hook prefetches in parallel with DFS when provided)
    try {
      const baseUrl = connectedSite?.siteUrl?.replace(/\/+$/, '') || '';
      const seed =
        row.keyword?.trim() ||
        row.keyword_focus?.trim() ||
        keywordData.keyword?.trim() ||
        '';
      const slug = seed ? generateSEOSlug(seed) : '';
      const pageUrl = baseUrl && slug ? `${baseUrl}/${slug}` : '';
      const portfolioBlockedHosts =
        options.portfolioBlockedHosts && options.portfolioBlockedHosts.length > 0
          ? options.portfolioBlockedHosts
          : undefined;

      const semrush: SemrushBulkEnrichmentResult =
        prefetchedResearch?.semrush != null
          ? prefetchedResearch.semrush
          : await fetchSemrushBulkEnrichment({
              pageUrl,
              seedKeyword: seed,
              portfolioBlockedHosts,
            });

      const ragJson = buildSemrushKeywordsRagJson(semrush);
      if (ragJson.trim()) {
        semrushKeywordsContext = ragJson;
      }
      const clusterScatter =
        !semrush.skipped &&
        ((semrush.urlOrganicKeywords?.length ?? 0) > 0 || (semrush.phraseRelatedKeywords?.length ?? 0) > 0)
          ? buildSemrushClusterScatterPlan({
              acfKeyword: seed || keywordData.keyword || '',
              urlOrganicKeywords: semrush.urlOrganicKeywords ?? [],
              phraseRelatedKeywords: semrush.phraseRelatedKeywords ?? [],
            })
          : undefined;
      const scatterJson = buildSemrushScatterContextJson(clusterScatter);
      if (scatterJson) {
        semrushScatterContext = scatterJson;
      }
      const semrushFileName = BulkFileManager.generateFileName(row, 'sem_rush', timestamp);
      const semrushFileId = BulkFileManager.createFileId(rowIndex, 'sem_rush', timestamp);
      const semrushFile: BulkGeneratedFile = {
        id: semrushFileId,
        rowIndex,
        fileName: semrushFileName,
        content: JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            pageUrl,
            seedKeyword: seed,
            semrush,
            externalSemrushUrls: semrush.externalSemrushUrls ?? [],
            clusterScatter: clusterScatter ?? undefined,
            primaryExternalCitationUrl: prefetchedResearch?.primaryExternalCitationUrl ?? null,
            intelligentMerge: prefetchedResearch?.intelligentMerge ?? null,
          },
          null,
          2
        ),
        mimeType: 'application/json',
        status: 'completed',
        timestamp,
        rowData: row,
      };
      fileManager.addFile(semrushFile);
      generatedFiles.push(semrushFile);
      options.onProgress?.(rowIndex, 0, 'Semrush enrichment ready');

      semrushSnapshotForAcf = semrush;
      semrushCitationForAcf = prefetchedResearch?.primaryExternalCitationUrl ?? null;
      intelligentMergeForAcf = prefetchedResearch?.intelligentMerge ?? null;
    } catch (e) {
      console.warn('[Bulk Auto-Generate] Semrush enrichment failed (non-fatal):', e);
    }
    
    selectedKeywords = autoSelectKeywords(aiAnalysis, keywordsWithVolumeData);
    selectedH2Sections = autoSelectH2Sections(aiAnalysis);
    selectedPeopleAlsoAsk = autoSelectPeopleAlsoAsk(aiAnalysis);
    const primaryKeywordForSelection =
      keywordData.keyword?.trim() ||
      enrichedRow.keyword?.trim() ||
      row.keyword?.trim() ||
      selectedKeywords[0] ||
      "";
    const selectedKeywordFileName = BulkFileManager.generateFileName(enrichedRow, "selected_keyword", timestamp);
    const selectedKeywordFile: BulkGeneratedFile = {
      id: BulkFileManager.createFileId(rowIndex, "selected-keyword", timestamp),
      rowIndex,
      fileName: selectedKeywordFileName,
      content: buildBulkSelectedKeywordArtifactPayload(
        primaryKeywordForSelection,
        selectedKeywords,
        selectedPeopleAlsoAsk,
      ),
      mimeType: "application/json",
      status: "completed",
      timestamp,
      rowData: enrichedRow,
    };
    fileManager.addFile(selectedKeywordFile);
    generatedFiles.push(selectedKeywordFile);
    emitEntitySapPipelineHarnessDone(options, rowIndex, enrichedRow, "Selected keyword");
    importedDraftLinks =
      parseImportedLinksJson(enrichedRow.imported_links_json ?? row.imported_links_json) ?? [];
    const importedSections = options.updateTargetPostId != null
      ? undefined
      : parseImportedSectionsJson(enrichedRow.imported_sections_json ?? row.imported_sections_json);
    importedH2Outline = importedBodyH2Outline(importedSections);

    const modifierUrls =
      parseModifierLinksJson(enrichedRow.modifier_links_json ?? row.modifier_links_json)?.map(
        (link) => link.url,
      ) ?? [];
    modifierExternalLinks = [];
    if (modifierUrls.length > 0) {
      options.onProgress?.(rowIndex, 0, 'Research external links...');
      modifierExternalLinks = await researchModifierExternalLinks(modifierUrls);
      const modifierLinksFileName = BulkFileManager.generateFileName(enrichedRow, 'modifier_external_links', timestamp);
      const modifierLinksFile: BulkGeneratedFile = {
        id: BulkFileManager.createFileId(rowIndex, 'modifier-external-links', timestamp),
        rowIndex,
        fileName: modifierLinksFileName,
        content: JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            modifier_links_json: enrichedRow.modifier_links_json ?? row.modifier_links_json,
            links: modifierExternalLinks,
          },
          null,
          2,
        ),
        mimeType: 'application/json',
        status: 'completed',
        timestamp,
        rowData: enrichedRow,
      };
      fileManager.addFile(modifierLinksFile);
      generatedFiles.push(modifierLinksFile);
    }

    rowExplicitExternalPairs = buildRowExplicitExternalAllowlist({
      modifierExternalLinks,
      importedDraftLinks,
    });
    rowExternalUrlsForSanitize = externalUrlsFromPairs(rowExplicitExternalPairs);

    prefilledRowContract = formatPrefilledBulkRowContractFromCsvRow(enrichedRow);

    const serpKeywordBase =
      enrichedRow.keyword?.trim() ||
      row.keyword?.trim() ||
      keywordData.keyword?.trim() ||
      '';
    const cachedRowBriefEarly = parseSeoContentBriefFromRow(enrichedRow);
    const serpKeyword =
      options.updateTargetPostId != null && cachedRowBriefEarly?.focusKeyword?.trim()
        ? cachedRowBriefEarly.focusKeyword.trim()
        : serpKeywordBase;
    const sitesToPostForTemplate = buildSitesToPostFromPosting(options.wordPressPosting, enrichedRow.entity);
    serpSite = sitesToPostForTemplate[0]?.site;
    pipelineSiteId = serpSite?.id;
    pipelineResearchModel =
      options.selectedModel?.trim() || getResearchModel(pipelineSiteId);
    pipelineBlogModel = getProductionModel(pipelineSiteId);
    pipelineImageModel = getImageModel(pipelineSiteId);
    const serpBaseUrl =
      serpSite?.siteUrl?.replace(/\/+$/, '') ||
      connectedSite?.siteUrl?.replace(/\/+$/, '') ||
      '';
    const serpSlug = serpKeyword ? generateSEOSlug(serpKeyword) : '';
    destinationPageUrl = enrichedRow.destination_url?.trim() || row.destination_url?.trim() || "";
    const serpPageUrl =
      destinationPageUrl ||
      (serpBaseUrl && serpSlug ? `${serpBaseUrl}/${serpSlug}` : serpBaseUrl);
    const cityLabel = resolveSiteLocationLabel(serpSite, serpKeyword) || "";
    const entityPlace = entityForLocalTemplate?.trim() || "";
    const cityToken = cityLabel.split(",")[0]?.trim().toLowerCase() || "";
    const serpLocation = entityPlace
      ? cityLabel && cityToken && !entityPlace.toLowerCase().includes(cityToken)
        ? `${entityPlace}, ${cityLabel}`
        : entityPlace
      : cityLabel;

    if (!serpKeyword) {
      throw new Error('SERP + LLM audit requires a row keyword');
    }
    if (!serpPageUrl) {
      throw new Error('SERP + LLM audit requires a site URL for the target page');
    }

    options.onProgress?.(rowIndex, 0, 'Running SERP + LLM audit (before checklist)...');
    const serpKeywordNorm = serpKeyword.trim().toLowerCase();
    const workflowSerpOutputs =
      options.workflowSerpResearch?.getOutputs?.()
      ?? options.workflowSerpResearch?.outputs;
    const cachedRowBrief = parseSeoContentBriefFromRow(enrichedRow);
    const cachedWorkflowBrief = workflowSerpOutputs?.length
      ? await loadWorkflowSerpResearchBrief(workflowSerpOutputs, serpKeyword)
      : null;

    let serpLlmBrief: SeoContentBriefV1;
    let serpStoredFile: string | null = null;

    if (
      cachedRowBrief
      && (
        cachedRowBrief.focusKeyword.trim().toLowerCase() === serpKeywordNorm
        || options.updateTargetPostId != null
      )
    ) {
      serpLlmBrief = cachedRowBrief;
      options.onProgress?.(rowIndex, 0, 'SERP brief loaded from row');
    } else if (
      cachedWorkflowBrief
      && cachedWorkflowBrief.brief.focusKeyword.trim().toLowerCase() === serpKeywordNorm
    ) {
      serpLlmBrief = cachedWorkflowBrief.brief;
      serpStoredFile = cachedWorkflowBrief.storedFile;
      options.onProgress?.(rowIndex, 0, 'SERP brief loaded from workflow RAG');
    } else {
      const wave = await fetchSeoContentBriefWave({
        keyword: serpKeyword,
        pageUrl: serpPageUrl,
        site: serpSite,
        location: serpLocation || undefined,
        geoHint: enrichedRow.title?.trim() || row.title?.trim(),
        callbacks: {
          onProgress: (message) => options.onProgress?.(rowIndex, 0, message),
        },
      });
      serpLlmBrief = wave.brief;
      serpStoredFile = wave.storedFile;
    }

    llmOkCount = serpLlmBrief.llmAudit?.platforms.filter((p) => p.status === "ok").length ?? 0;
    options.onProgress?.(rowIndex, 0, `Brief merged (${llmOkCount}/4 LLM platforms)`);

    const swotText = swotTextFromResearchFields({
      promptModifier: enrichedRow.prompt_modifier,
      seoResearch: enrichedRow.seo_research,
    });
    const companyName = (serpSite?.name || connectedSite?.name || "").trim();
    if (!companyName) {
      throw new Error("Topic fan-out requires a connected site name");
    }
    const pageExcerptFromImport = importedSections
      ?.map((s) => `${s.h2}\n${s.body}`)
      .join("\n\n");
    serpLlmBrief = await runTopicResearchFanout({
      brief: serpLlmBrief,
      keyword: serpKeyword,
      title: enrichedRow.title,
      companyName,
      location: serpLocation || undefined,
      site: serpSite,
      swotText,
      pageExcerpt: pageExcerptFromImport || enrichedRow.imported_preamble_html?.trim(),
      onProgress: (message) => options.onProgress?.(rowIndex, 0, message),
      forceRefresh: options.forceFreshTopicFanout === true,
    });
    firstPartyAuthorityBlock = firstPartyAuthorityBlockFromBrief(serpLlmBrief, swotText);

    options.onProgress?.(rowIndex, 0, 'Classifying LLM audit authority links…');
    const llmAuditAuthorityLinks = await resolveLlmAuditAuthorityLinksForChecklist({
      brief: serpLlmBrief,
      siteUrl: serpSite?.siteUrl ?? connectedSite?.siteUrl,
      companyName,
      location: serpLocation || undefined,
      siteId: serpSite?.id ?? connectedSite?.id,
      onClassifierJsonFailure: (detail) => {
        const artifactBody = JSON.stringify(
          {
            error: detail.error,
            repairSteps: detail.repairSteps,
            rawLlmOutput: detail.rawText,
          },
          null,
          2,
        );
        const failureFile: BulkGeneratedFile = {
          id: BulkFileManager.createFileId(rowIndex, "llm-audit-classifier-raw", timestamp),
          rowIndex,
          fileName: BulkFileManager.generateFileName(enrichedRow, "llm_audit_classifier_raw", timestamp),
          content: artifactBody,
          mimeType: "application/json",
          status: "error",
          timestamp,
          rowData: enrichedRow,
        };
        fileManager.addFile(failureFile);
        generatedFiles.push(failureFile);
        console.warn("[Bulk] LLM audit authority classifier JSON failed; continuing row:", detail.error);
      },
    });
    rowExplicitExternalPairs = buildRowExplicitExternalAllowlist({
      modifierExternalLinks,
      importedDraftLinks,
      llmAuditAuthorityLinks,
    });
    rowExternalUrlsForSanitize = externalUrlsFromPairs(rowExplicitExternalPairs);

    selectedResearchLinks = [
      ...new Set([
        ...(entityWikiUrl ? [entityWikiUrl] : []),
        ...importedDraftLinks.map((link) => link.url),
        ...modifierExternalLinks.map((link) => link.url),
        ...llmAuditAuthorityLinks.map((link) => link.url),
      ]),
    ];

    if (options.workflowSerpResearch?.commitBrief) {
      const commitKeyword = serpLlmBrief.focusKeyword.trim() || serpKeyword;
      await options.workflowSerpResearch.commitBrief(commitKeyword, serpLlmBrief, serpStoredFile);
    }

    llmAuditSummaryPrompt = llmAuditGuidanceFromBrief(serpLlmBrief);
    const workflowDfsOutputs =
      options.workflowDfsArticleAudit?.getOutputs?.()
      ?? options.workflowDfsArticleAudit?.outputs;
    const cachedWorkflowArticleAudit = workflowDfsOutputs?.length
      ? await loadWorkflowDfsArticleAudit(workflowDfsOutputs, serpPageUrl)
      : null;
    dfsArticleAuditBlock = cachedWorkflowArticleAudit?.audit
      ? formatDfsArticleAuditHarnessPromptBlock(cachedWorkflowArticleAudit.audit)
      : "";
    serpLlmBriefJson = JSON.stringify(serpLlmBrief, null, 2);
    enrichedRow = { ...enrichedRow, seo_research: serpLlmBriefJson };

    const seoBriefFileName = BulkFileManager.generateFileName(enrichedRow, 'seo_research_brief', timestamp);
    const seoBriefFile: BulkGeneratedFile = {
      id: BulkFileManager.createFileId(rowIndex, 'seo-research-brief', timestamp),
      rowIndex,
      fileName: seoBriefFileName,
      content: serpLlmBriefJson,
      mimeType: 'application/json',
      status: 'completed',
      timestamp,
      rowData: enrichedRow,
    };
    fileManager.addFile(seoBriefFile);
    generatedFiles.push(seoBriefFile);
    emitEntitySapPipelineHarnessDone(options, rowIndex, enrichedRow, "SERP research brief");
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }

  return {
    enrichedRow,
    aiAnalysis,
    semrushKeywordsContext,
    semrushScatterContext,
    rowExternalUrlsForSanitize,
    semrushSnapshotForAcf,
    semrushCitationForAcf,
    intelligentMergeForAcf,
    selectedKeywords,
    selectedH2Sections,
    selectedPeopleAlsoAsk,
    importedDraftLinks,
    importedH2Outline,
    modifierExternalLinks,
    rowExplicitExternalPairs,
    prefilledRowContract,
    pipelineSiteId,
    pipelineResearchModel,
    pipelineBlogModel,
    pipelineImageModel,
    serpLlmBrief,
    serpLlmBriefJson,
    serpStoredFile,
    llmOkCount,
    llmAuditSummaryPrompt,
    dfsArticleAuditBlock,
    firstPartyAuthorityBlock,
    llmAuditAuthorityLinks,
    selectedResearchLinks,
    destinationPageUrl,
    entityForLocalTemplate,
    serpSite,
  };
}
