import { buildFocusedArticlePurpose } from "@/lib/content-generation/article-length-policy";
import { parseImportedLinksJson, parseImportedSectionsJson, parseModifierLinksJson } from './bulk-csv-parser';
import { importedBodyH2Outline } from './blog-import-parser';
import { injectImportedLinksIntoBlueprintAgents, injectImportedLinksIntoChecklist } from './blog-import-draft-links';
import { ImportedDraftLink } from './blog-import-draft-links';
import { injectEntityWikipediaIntoBlueprintAgents, injectEntityWikipediaIntoChecklist } from './entity-wikipedia-prompt';
import { injectModifierExternalLinksIntoBlueprintAgents, injectModifierExternalLinksIntoChecklist, injectLlmAuditAuthorityLinksIntoBlueprintAgents, injectLlmAuditAuthorityLinksIntoChecklist, researchModifierExternalLinks } from './modifier-external-links';
import { ModifierExternalLink } from './modifier-external-links';
import { enforceForbiddenWordsOnBlueprint, formatBlueprintFileContent, formatChecklistFileContent, GLOBAL_FORBIDDEN_WORDS_PROMPT_BLOCK, prepareChecklistForPipeline } from '@/lib/content-word-blocklist';
import { formatPrefilledBulkRowContractFromCsvRow, hasCsvFilledMeta } from './prefilled-bulk-row-contract';
import { generateChecklistFromSelections, generateBlueprintFromTemplate } from '../blog-template-builder';
import { BlogTemplateContext } from '../blog-template-builder';
import { getImageModel, getProductionModel, getResearchModel } from '../optimization-settings-storage';
import { buildImagePrompt } from '../image-prompt-builder';
import { ImageChecklistItem } from '../image-checklist-builder';
import { generateSEOImageFilename } from '../image-filename-generator';
import { KeywordData, KeywordAIAnalysis } from '../keyword-types';
import { BulkFileManager } from '../bulk-file-manager';
import { BulkGeneratedFile } from '../bulk-file-manager';
import { rowUsesGoogleImageFeatured } from '../overview/overview-content-optimize-pipeline';
import { recordPeerFeaturedImageOutcome } from './peer-featured-image-report';
import { markdownToHtml, generateExcerpt } from '../markdown-to-html';
import { sanitizeWordPressSlugSegment } from '../rank-math-redirect-csv';
import { bulkPostsToExtraTextLinkRows, emitEntitySapPipelineHarnessDone } from '@/lib/bulk/bulk-harness-progress';
import { BulkInternalLinkRow } from '@/lib/bulk/bulk-harness-progress';
import { publishBulkRowToWordPressSites } from '@/lib/bulk/bulk-wordpress-publish-row';
import { buildPreBlogSeoResearchSkeleton, mergeBlueprintIntoPreBlogSkeleton, buildPostMarkdownAcfSeoFaqBundle } from '@/lib/content-generation/bulk-acf-seo-bundle';
import { PrecomputedAcfSeoBundle } from '@/lib/content-generation/bulk-acf-seo-bundle';
import { generateMetaDescription } from '@/lib/content-generation/content-generator';
import { resolveBulkWordPressPostTitle } from '@/lib/bulk/bulk-post-title-agent';
import { buildRowExplicitExternalAllowlist, externalUrlsFromPairs } from '../content-generation/external-link-placeholders';
import { generateSEOSlug } from '../seo-slug-generator';
import { loadApiKey } from '../api';
import { fetchSemrushBulkEnrichment } from '../wordpress-api/semrush';
import { SemrushBulkEnrichmentResult } from '../wordpress-api/semrush';
import { IntelligentKeywordResearchMergeResult } from './intelligent-keyword-research-merge';
import { buildSemrushKeywordsRagJson } from '../semrush-keywords-rag';
import { buildSemrushClusterScatterPlan, buildSemrushScatterContextJson } from '../semrush-cluster-scatter';
import { fetchSeoContentBriefWave } from '@/lib/llm-audit/fetch-seo-content-brief-wave';
import { mergeSeoBriefIntoBulkSkeleton } from '@/lib/llm-audit/fetch-merged-seo-content-brief';
import { llmAuditGuidanceFromBrief } from '@/lib/llm-audit/llm-audit-dataforseo';
import { resolveSiteLocationLabel } from '@/lib/llm-audit/resolve-site-location-label';
import { SeoContentBriefV1 } from '@/lib/overview-seo-content-brief';
import { runTopicResearchFanout } from '@/lib/content-optimization/topic-research-fanout';
import { firstPartyAuthorityBlockFromBrief, swotTextFromResearchFields } from '@/lib/content-optimization/first-party-authority-prompt';
import { resolveLlmAuditAuthorityLinksForChecklist } from '@/lib/llm-audit/llm-audit-authority-links';
import { loadWorkflowSerpResearchBrief, parseSeoContentBriefFromRow } from '@/lib/workflow/workflow-serp-research-cache';
import { loadWorkflowDfsArticleAudit } from '@/lib/workflow/workflow-dfs-article-audit-cache';
import { formatDfsArticleAuditHarnessPromptBlock } from '@/lib/dfs-article-audit/format-dfs-article-audit-harness';
import { acfOriginAppliesForSitemapType } from '@/lib/acf-origin-applies';
import { resolveSerpLocationName } from '@/lib/llm-audit/fetch-seo-content-brief-wave';
import { BulkProcessingOptions, PrefetchedBulkKeywordResearch } from './bulk-auto-generate-types';
import type { CSVRow } from './bulk-csv-parser';
import { resolveBulkPrimaryKeyword } from './bulk-primary-keyword';
import { autoSelectKeywords, autoSelectH2Sections, autoSelectPeopleAlsoAsk } from './bulk-blueprint-generator';
import { generateMarkdownContentHarnessed, addEntityLinksToContent } from './bulk-content-generator';
import type { HarnessPromptEnv } from './bulk-content-generator';
import { generateImageChecklist } from './bulk-image-generator';
import { runFeaturedImage } from '@/lib/image-generator/run-featured-image';
import { runImageChecklist } from '@/lib/image-generator/run-image-checklist';
import type { ImageGeneratorOptions, ImageGeneratorRunContext } from '@/lib/image-generator/image-generator-options';
import { keepBlogPlayLinkTargets, inventoryRowsToWordPressLinkables } from './bulk-generation-wp-inventory';
import type { LinkTargetsPlan } from './bulk-generation-wp-inventory';
import { getBulkGenerationWpInventoryIfReady } from './bulk-generation-inventory-cache-store';
import { runContentLinkTargetsHarness } from '../overview/overview-content-link-targets-harness-run';
import { OptimizationFileManager } from '../optimization-file-manager';
import { populateACFFieldsFromDFS } from '@/lib/bulk/bulk-row-acf-meta';
import { buildSitesToPostFromPosting } from '@/lib/bulk/bulk-wordpress-link-prefetch';
import { buildBulkSelectedKeywordArtifactPayload, resolveRankMathFromKeywordResearch } from '@/lib/bulk/bulk-keyword-research-artifacts';
import { runBulkRowResearchEnrichmentPhase, bulkRowSerpLocationName } from './bulk-row-research-enrichment';

/**
 * Writes full DataForSEO / keyword-research payload to the bulk file list as soon as research completes,
 * before Semrush enrichment, checklist, or blueprint (so the UI can show downloads immediately).
 */
export function addKeywordResearchSnapshotToBulkFiles(
  rowIndex: number,
  row: CSVRow,
  fileManager: BulkFileManager,
  options: Pick<BulkProcessingOptions, 'onProgress'>,
  timestamp: number,
  payload: {
    keywordData: KeywordData;
    aiAnalysis: KeywordAIAnalysis;
    keywordsVolumeData: KeywordData[];
    paaRawResponse: unknown;
    primaryKeyword?: string;
    semrush?: SemrushBulkEnrichmentResult | null;
    intelligentMerge?: IntelligentKeywordResearchMergeResult | null;
    primaryExternalCitationUrl?: string | null;
  }
): BulkGeneratedFile {
  const fileName = BulkFileManager.generateFileName(row, 'dfs_research', timestamp);
  const id = BulkFileManager.createFileId(rowIndex, 'dfs-research', timestamp);
  const body = {
    generatedAt: new Date().toISOString(),
    primaryKeyword: payload.primaryKeyword ?? row.keyword,
    dataforseo: {
      keywordData: payload.keywordData,
      aiAnalysis: payload.aiAnalysis,
      keywordsVolumeData: payload.keywordsVolumeData,
      paaRawResponse: payload.paaRawResponse,
    },
    semrush: payload.semrush ?? null,
    intelligentMerge: payload.intelligentMerge ?? null,
    primaryExternalCitationUrl: payload.primaryExternalCitationUrl ?? null,
    keywordData: payload.keywordData,
    aiAnalysis: payload.aiAnalysis,
    keywordsVolumeData: payload.keywordsVolumeData,
    paaRawResponse: payload.paaRawResponse,
  };
  let content: string;
  try {
    content = JSON.stringify(body, null, 2);
  } catch {
    content = JSON.stringify(
      {
        generatedAt: body.generatedAt,
        primaryKeyword: body.primaryKeyword,
        error: 'Could not stringify full DFS snapshot (payload too large or circular)',
        keywordData: payload.keywordData,
      },
      null,
      2
    );
  }
  const file: BulkGeneratedFile = {
    id,
    rowIndex,
    fileName,
    content,
    mimeType: 'application/json',
    status: 'completed',
    timestamp,
    rowData: row,
  };
  fileManager.addFile(file);
  options.onProgress?.(rowIndex, 0, 'Keyword research ready');
  return file;
}

/**
 * Generate blueprint and content for a row (after keyword research is complete).
 */
export async function generateBlueprintAndContent(
  rowIndex: number,
  row: CSVRow,
  keywordData: KeywordData,
  aiAnalysis: KeywordAIAnalysis,
  keywordsWithVolumeData: any[],
  paaRawResponse: any,
  options: BulkProcessingOptions,
  fileManager: BulkFileManager,
  knowledgeFiles: Array<{ name: string; content: string }> = [],
  activeKnowledgeBaseText: string = '',
  connectedSite?: { name: string; siteUrl: string },
  wordPressPosts?: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>,
  prefetchedResearch?: PrefetchedBulkKeywordResearch | null
): Promise<BulkGeneratedFile[]> {
  const timestamp = Date.now();
  const generatedFiles: BulkGeneratedFile[] = [];
  let semrushKeywordsContext: string | undefined;
  let semrushScatterContext: string | undefined;
  let rowExternalUrlsForSanitize: string[] = [];
  let semrushSnapshotForAcf: SemrushBulkEnrichmentResult | undefined;
  let semrushCitationForAcf: string | null = null;
  let intelligentMergeForAcf: IntelligentKeywordResearchMergeResult | null = null;

  // Populate ACF fields from DFS data (for new posts, skipping GSC)
  const acfFieldsFromDFS = populateACFFieldsFromDFS(row, keywordData, aiAnalysis, keywordsWithVolumeData);
  // Merge ACF fields: existing row values take precedence, then DFS data
  let enrichedRow: CSVRow = {
    ...row,
    ...acfFieldsFromDFS,
    // Preserve existing ACF fields if they exist
    date_modifier: row.date_modifier || acfFieldsFromDFS.date_modifier,
    prompt_modifier: row.prompt_modifier || acfFieldsFromDFS.prompt_modifier,
    service_area_fields: row.service_area_fields || acfFieldsFromDFS.service_area_fields,
    ...(row.sitemap_type === 'entity' || acfFieldsFromDFS.origin
      ? { origin: row.origin || acfFieldsFromDFS.origin }
      : {}),
  };

  const rowEntity = enrichedRow.entity?.trim() ?? "";
  const sitesToPostForTemplate = buildSitesToPostFromPosting(options.wordPressPosting, enrichedRow.entity);
  const hasRowEntity = Boolean(rowEntity && rowEntity !== "N/A");
  const useEntitySitemapTemplate =
    hasRowEntity &&
    (enrichedRow.sitemap_type === "entity" ||
      sitesToPostForTemplate.some((s) => s.sitemapType === "entity") ||
      options.useEntitySitemapTemplate === true);
  let entityForLocalTemplate = hasRowEntity ? rowEntity : undefined;
  const entityWikiUrl = options.skipWikipediaLookup
    ? undefined
    : enrichedRow.wikipedia_url?.trim() || undefined;
  const entityWikiTitle = options.skipWikipediaLookup
    ? undefined
    : enrichedRow.wikipedia_title?.trim() || undefined;
  const bulkOptions: BulkProcessingOptions = {
    ...options,
    useEntitySitemapTemplate,
    ...(entityForLocalTemplate ? { sequentialHarnessSections: true } : {}),
  };
  const postsForInternalLinks = keepBlogPlayLinkTargets(wordPressPosts ?? []);

  try {
    const researchPhase = await runBulkRowResearchEnrichmentPhase({
      rowIndex,
      row,
      enrichedRow,
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
    });
    enrichedRow = researchPhase.enrichedRow;
    semrushKeywordsContext = researchPhase.semrushKeywordsContext;
    semrushScatterContext = researchPhase.semrushScatterContext;
    rowExternalUrlsForSanitize = researchPhase.rowExternalUrlsForSanitize;
    semrushSnapshotForAcf = researchPhase.semrushSnapshotForAcf;
    semrushCitationForAcf = researchPhase.semrushCitationForAcf;
    intelligentMergeForAcf = researchPhase.intelligentMergeForAcf;
    const selectedKeywords = researchPhase.selectedKeywords;
    const selectedH2Sections = researchPhase.selectedH2Sections;
    const selectedPeopleAlsoAsk = researchPhase.selectedPeopleAlsoAsk;
    const importedDraftLinks = researchPhase.importedDraftLinks;
    const importedH2Outline = researchPhase.importedH2Outline;
    const modifierExternalLinks = researchPhase.modifierExternalLinks;
    const rowExplicitExternalPairs = researchPhase.rowExplicitExternalPairs;
    const prefilledRowContract = researchPhase.prefilledRowContract;
    const pipelineSiteId = researchPhase.pipelineSiteId;
    const pipelineResearchModel = researchPhase.pipelineResearchModel;
    const pipelineBlogModel = researchPhase.pipelineBlogModel;
    const pipelineImageModel = researchPhase.pipelineImageModel;
    const serpLlmBrief = researchPhase.serpLlmBrief;
    const serpLlmBriefJson = researchPhase.serpLlmBriefJson;
    const serpStoredFile = researchPhase.serpStoredFile;
    const llmOkCount = researchPhase.llmOkCount;
    const llmAuditSummaryPrompt = researchPhase.llmAuditSummaryPrompt;
    const dfsArticleAuditBlock = researchPhase.dfsArticleAuditBlock;
    const firstPartyAuthorityBlock = researchPhase.firstPartyAuthorityBlock;
    const llmAuditAuthorityLinks = researchPhase.llmAuditAuthorityLinks;
    const selectedResearchLinks = researchPhase.selectedResearchLinks;
    const destinationPageUrl = researchPhase.destinationPageUrl;
    entityForLocalTemplate = researchPhase.entityForLocalTemplate;
    const serpSite = researchPhase.serpSite;

    // Generate checklist (after SERP + LLM brief)
    options.onProgress?.(rowIndex, 0, 'Reading blacklist...');
    options.onProgress?.(rowIndex, 0, 'Generating checklist...');
    let checklistResult = await generateChecklistFromSelections(
      selectedKeywords,
      selectedH2Sections,
      enrichedRow.title,
      keywordData,
      {
        apiKey: options.openRouterApiKey,
        model: pipelineResearchModel,
        temperature: options.temperature || 1.0,
        maxTokens: options.maxTokens || 4000,
        topP: options.topP || 0.9,
        userPrompt: enrichedRow.prompt_modifier || enrichedRow.modifier, // Use prompt_modifier if available, fallback to modifier
        entity: entityForLocalTemplate,
        serpData: paaRawResponse,
        selectedPeopleAlsoAsk,
        selectedResearchLinks,
        connectedSite,
        postsForInternalLinks,
        runExternalResearch: rowExplicitExternalPairs.length > 0,
        locationName: bulkRowSerpLocationName(enrichedRow),
        languageCode: "en",
        importedDraftLinks: importedDraftLinks.length ? importedDraftLinks : undefined,
        modifierExternalLinks: modifierExternalLinks.length ? modifierExternalLinks : undefined,
        userExternalLinks: rowExplicitExternalPairs.length ? rowExplicitExternalPairs : undefined,
        wikipediaUrl: entityWikiUrl,
        wikipediaTitle: entityWikiTitle,
        prefilledRowContract: prefilledRowContract || undefined,
        llmAuditSummary: llmAuditSummaryPrompt || undefined,
        dfsArticleAuditBlock: dfsArticleAuditBlock || undefined,
        firstPartyAuthorityBlock: firstPartyAuthorityBlock || undefined,
        siteId: serpSite?.id ?? connectedSite?.id,
        primaryKeyword: keywordData.keyword,
        currentPageUrl: destinationPageUrl || undefined,
        ...(llmAuditAuthorityLinks.length ? { llmAuditAuthorityLinks } : {}),
        ...(importedH2Outline.length ? { importedH2Outline } : {}),
        ...(!entityForLocalTemplate ? { serpResearchBriefJson: serpLlmBriefJson } : {}),
        ...(options.forbiddenLiveH2s?.length ? { forbiddenLiveH2s: options.forbiddenLiveH2s } : {}),
      }
    );
    let checklist = injectImportedLinksIntoChecklist(checklistResult.items, importedDraftLinks);
    checklist = injectModifierExternalLinksIntoChecklist(checklist, modifierExternalLinks);
    checklist = injectLlmAuditAuthorityLinksIntoChecklist(checklist, llmAuditAuthorityLinks);
    if (entityForLocalTemplate && entityWikiUrl) {
      checklist = injectEntityWikipediaIntoChecklist(checklist, {
        entity: entityForLocalTemplate,
        wikipediaUrl: entityWikiUrl,
        wikipediaTitle: entityWikiTitle,
      });
    }
    const pipelineChecklistOpts = {
      sapEntity: entityForLocalTemplate || undefined,
    };
    const pipelineChecklist = prepareChecklistForPipeline(checklist, pipelineChecklistOpts);

    if (pipelineChecklist.length === 0) {
      throw new Error('Failed to generate checklist');
    }

    const checklistFileName = BulkFileManager.generateFileName(enrichedRow, 'blog_checklist', timestamp);
    const checklistFileId = BulkFileManager.createFileId(rowIndex, 'blog-checklist', timestamp);
    const checklistFile: BulkGeneratedFile = {
      id: checklistFileId,
      rowIndex,
      fileName: checklistFileName,
      content: JSON.stringify(
        {
          forbiddenWordsPolicy: GLOBAL_FORBIDDEN_WORDS_PROMPT_BLOCK,
          generatedAt: new Date().toISOString(),
          title: enrichedRow.title,
          serpStoredFile,
          llmAuditPlatformCount: llmOkCount,
          lines: pipelineChecklist,
          downloadText: formatChecklistFileContent(checklist),
        },
        null,
        2
      ),
      mimeType: 'application/json',
      status: 'completed',
      timestamp,
      rowData: row,
    };
    checklist = pipelineChecklist;
    fileManager.addFile(checklistFile);
    generatedFiles.push(checklistFile);
    emitEntitySapPipelineHarnessDone(options, rowIndex, enrichedRow, "Checklist");
    options.onProgress?.(rowIndex, 0, 'Blog checklist ready');

    let linkTargetsPlan: LinkTargetsPlan | undefined;
    const linkSiteId = serpSite?.id ?? connectedSite?.id;
    const linkApiKey = options.openRouterApiKey || loadApiKey();
    let linkPoolSource: BulkInternalLinkRow[] = postsForInternalLinks;
    if (!linkPoolSource.length && linkSiteId) {
      const invRows = getBulkGenerationWpInventoryIfReady(linkSiteId);
      if (invRows?.length) {
        linkPoolSource = keepBlogPlayLinkTargets(inventoryRowsToWordPressLinkables(invRows));
      }
    }
    const bodyTitlesForLinkPlan = checklistResult.h2Outline?.length
      ? checklistResult.h2Outline
      : selectedH2Sections;
    if (
      linkSiteId &&
      linkApiKey?.trim() &&
      linkPoolSource.length > 0 &&
      bodyTitlesForLinkPlan.length > 0
    ) {
      options.onProgress?.(rowIndex, 0, "Planning internal link targets...");
      const linkOptFileManager = new OptimizationFileManager();
      const linkFileSlug =
        sanitizeWordPressSlugSegment(enrichedRow.target_slug ?? "") ||
        sanitizeWordPressSlugSegment(keywordData.keyword) ||
        "article";
      linkTargetsPlan = await runContentLinkTargetsHarness({
        apiKey: linkApiKey,
        siteId: linkSiteId,
        primaryKeyword: keywordData.keyword,
        bodySectionTitles: bodyTitlesForLinkPlan,
        linkPool: bulkPostsToExtraTextLinkRows(linkPoolSource),
        fileManager: linkOptFileManager,
        fileSlug: linkFileSlug,
      });
      const linkTargetsOptFile = linkOptFileManager
        .getFiles()
        .find((file) => file.name.toLowerCase().startsWith("link-targets-"));
      if (linkTargetsOptFile) {
        const linkTargetsFile: BulkGeneratedFile = {
          id: BulkFileManager.createFileId(rowIndex, "link-targets", timestamp),
          rowIndex,
          fileName: linkTargetsOptFile.name,
          content: linkTargetsOptFile.content,
          mimeType: linkTargetsOptFile.mimeType,
          status: "completed",
          timestamp,
          rowData: enrichedRow,
        };
        fileManager.addFile(linkTargetsFile);
        generatedFiles.push(linkTargetsFile);
        emitEntitySapPipelineHarnessDone(
          options,
          rowIndex,
          enrichedRow,
          "Link targets",
          checklistResult.h2Outline ?? [],
        );
      }
    }

    const flowPurposeStr = options.flowPurpose || buildFocusedArticlePurpose(keywordData.keyword);
    const outlineTextForImage = `Blog checklist outline:\n${checklist.join('\n')}`;

    const entityForImage =
      enrichedRow.entity && enrichedRow.entity.trim() && enrichedRow.entity.trim() !== 'N/A'
        ? enrichedRow.entity.trim()
        : row.entity && row.entity.trim() && row.entity.trim() !== 'N/A'
          ? row.entity.trim()
          : undefined;
    const useGoogleMaps =
      rowUsesGoogleImageFeatured(row, options.featuredImageType) && !!entityForImage;
    if (rowUsesGoogleImageFeatured(row, options.featuredImageType) && !entityForImage) {
      throw new Error(
        `Google Maps image requested but no entity found for row ${rowIndex + 1}. Add an entity to the row or use AI-generated images.`
      );
    }
    const useAiImagePath = row.featuredImage !== 'n' && !useGoogleMaps;

    const imageChecklistLlmOptions = {
      apiKey: options.openRouterApiKey,
      model: pipelineResearchModel,
      temperature: options.temperature || 1.0,
      maxTokens: options.maxTokens || 4000,
      topP: options.topP || 0.9,
    };

    // Parallel: blueprint + image checklist + SEO skeleton (LLM audit already merged above)
    const sequentialDraft = Boolean(options.sequentialHarnessSections || useGoogleMaps);
    options.onProgress?.(
      rowIndex,
      0,
      sequentialDraft ? "Blueprint + SEO draft..." : "Blueprint + SEO draft (parallel)...",
    );
    const baseUserPrompt = enrichedRow.prompt_modifier || enrichedRow.modifier;
    const context: BlogTemplateContext = {
      flowTitle: enrichedRow.title,
      flowPurpose: flowPurposeStr,
      keywordData,
      userPrompt: baseUserPrompt?.trim() || undefined,
      prefilledRowContract: prefilledRowContract || undefined,
    };

    const metaTitleForBulk = enrichedRow.title || keywordData.keyword;
    const metaContextBulk = `Blog post title: "${metaTitleForBulk}". Primary keyword: "${keywordData.keyword}".`;
    const csvMetaDescription = hasCsvFilledMeta(enrichedRow)
      ? enrichedRow.meta_description!.trim()
      : "";

    const blueprintTemplateArgs = {
      apiKey: options.openRouterApiKey,
      model: pipelineResearchModel,
      temperature: options.temperature || 1.0,
      maxTokens: options.maxTokens || 8000,
      topP: options.topP || 0.9,
      connectedSite,
      entity: entityForLocalTemplate,
      importedDraftLinks: importedDraftLinks.length ? importedDraftLinks : undefined,
      modifierExternalLinks: modifierExternalLinks.length ? modifierExternalLinks : undefined,
      userExternalLinks: rowExplicitExternalPairs.length ? rowExplicitExternalPairs : undefined,
      wikipediaUrl: entityWikiUrl,
      wikipediaTitle: entityWikiTitle,
      llmAuditSummary: llmAuditSummaryPrompt || undefined,
      dfsArticleAuditBlock: dfsArticleAuditBlock || undefined,
      firstPartyAuthorityBlock: firstPartyAuthorityBlock || undefined,
      ...(llmAuditAuthorityLinks.length ? { llmAuditAuthorityLinks } : {}),
    };
    const preBlogSeoSkeleton = buildPreBlogSeoResearchSkeleton({
      keywordData,
      enrichedRow,
      semrushKeywordsContext,
      semrushScatterContext,
      flowTitle: enrichedRow.title,
    });

    let blueprintResultRaw: Awaited<ReturnType<typeof generateBlueprintFromTemplate>>;
    let precomputedImageChecklist: ImageChecklistItem[];
    let precomputedMetaDescription: string | undefined;

    if (sequentialDraft) {
      blueprintResultRaw = await generateBlueprintFromTemplate(
        pipelineChecklist,
        context,
        blueprintTemplateArgs,
      );
      precomputedImageChecklist = useAiImagePath
        ? await generateImageChecklist(
            enrichedRow.title,
            flowPurposeStr,
            outlineTextForImage,
            imageChecklistLlmOptions,
          )
        : [];
      precomputedMetaDescription = csvMetaDescription
        ? csvMetaDescription
        : await generateMetaDescription(
            metaContextBulk,
            keywordData.keyword,
            options.openRouterApiKey,
            pipelineSiteId,
            metaTitleForBulk,
            false,
          );
    } else {
      [blueprintResultRaw, precomputedImageChecklist, , precomputedMetaDescription] =
        await Promise.all([
          generateBlueprintFromTemplate(pipelineChecklist, context, blueprintTemplateArgs),
          useAiImagePath
            ? generateImageChecklist(
                enrichedRow.title,
                flowPurposeStr,
                outlineTextForImage,
                imageChecklistLlmOptions,
              )
            : Promise.resolve([] as ImageChecklistItem[]),
          Promise.resolve(preBlogSeoSkeleton),
          csvMetaDescription
            ? Promise.resolve(csvMetaDescription)
            : generateMetaDescription(
                metaContextBulk,
                keywordData.keyword,
                options.openRouterApiKey,
                pipelineSiteId,
                metaTitleForBulk,
                false,
              ),
        ]);
    }
    const blueprintAgentsWithImports = injectImportedLinksIntoBlueprintAgents(
      blueprintResultRaw.agents,
      importedDraftLinks,
    );
    const blueprintAgentsWithModifierLinks = injectModifierExternalLinksIntoBlueprintAgents(
      blueprintAgentsWithImports,
      modifierExternalLinks,
    );
    const blueprintAgentsWithAuthorityLinks = injectLlmAuditAuthorityLinksIntoBlueprintAgents(
      blueprintAgentsWithModifierLinks,
      llmAuditAuthorityLinks,
    );
    const blueprintAgentsLinked =
      entityForLocalTemplate && entityWikiUrl
        ? injectEntityWikipediaIntoBlueprintAgents(blueprintAgentsWithAuthorityLinks, {
            entity: entityForLocalTemplate,
            wikipediaUrl: entityWikiUrl,
            wikipediaTitle: entityWikiTitle,
          })
        : blueprintAgentsWithAuthorityLinks;
    const blueprintResult = entityForLocalTemplate
      ? {
          ...blueprintResultRaw,
          agents: blueprintAgentsLinked,
        }
      : enforceForbiddenWordsOnBlueprint(
          {
            ...blueprintResultRaw,
            agents: blueprintAgentsLinked,
          },
          { sapEntity: undefined },
        );
    if (checklistResult.h2Outline?.length) {
      (blueprintResult as { h2Outline?: string[] }).h2Outline = checklistResult.h2Outline;
    }

    mergeBlueprintIntoPreBlogSkeleton(preBlogSeoSkeleton, blueprintResult.title, blueprintResult.purpose);
    mergeSeoBriefIntoBulkSkeleton(preBlogSeoSkeleton, serpLlmBrief);

    if (blueprintResult.agents.length === 0) {
      throw new Error('No agents generated from template');
    }

    // Final validation: every agent must carry a [LINK] feature
    const agentsWithoutLinks = blueprintResult.agents.filter((agent) => {
      const features = Array.isArray(agent.features) ? agent.features : [];
      const hasLinkFeature = features.some(
        (f: string) => typeof f === 'string' && f.toLowerCase().trim().startsWith('[link]')
      );
      return !hasLinkFeature;
    });

    if (agentsWithoutLinks.length > 0) {
      console.error(
        `[Bulk Generate] ⚠️ ${agentsWithoutLinks.length} agent(s) missing [LINK] feature after generation. This should not happen - validation should have caught this.`
      );
      // The validation in generateBlueprintFromTemplate should have caught this, but log it anyway
    } else {
      console.log(`[Bulk Generate] ✅ All ${blueprintResult.agents.length} agents have [LINK] features`);
    }

    // Create blueprint JSON file
    const blueprintFileName = BulkFileManager.generateFileName(row, 'blueprint', timestamp);
    const blueprintFileId = BulkFileManager.createFileId(rowIndex, 'blueprint', timestamp);

    const blueprintFile: BulkGeneratedFile = {
      id: blueprintFileId,
      rowIndex,
      fileName: blueprintFileName,
      content: formatBlueprintFileContent({
        title: blueprintResult.title || enrichedRow.title,
        purpose: blueprintResult.purpose,
        agents: blueprintResult.agents,
        keyword: keywordData.keyword,
        entity: enrichedRow.entity,
        acfFields: {
          date_modifier: enrichedRow.date_modifier,
          prompt_modifier: enrichedRow.prompt_modifier,
          service_area_fields: enrichedRow.service_area_fields,
          ...(acfOriginAppliesForSitemapType(enrichedRow.sitemap_type) && enrichedRow.origin
            ? { origin: enrichedRow.origin }
            : {}),
        },
      }),
      mimeType: 'application/json',
      status: 'completed',
      timestamp,
      rowData: enrichedRow, // Use enriched row with ACF fields
    };

    fileManager.addFile(blueprintFile);
    generatedFiles.push(blueprintFile);
    emitEntitySapPipelineHarnessDone(
      options,
      rowIndex,
      enrichedRow,
      "Blueprint",
      checklistResult.h2Outline ?? [],
    );

    const flowTitleForBlueprint = blueprintResult.title || enrichedRow.title;
    const flowPurposeResolved = blueprintResult.purpose || flowPurposeStr;

    const bulkPrimaryKwResolved = resolveBulkPrimaryKeyword(
      row,
      enrichedRow,
      keywordData,
      blueprintResult.title,
    );
    const rankMetaForTitle = resolveRankMathFromKeywordResearch(keywordData);
    let bulkResolvedPostTitle: string;
    if (options.optimizePreserveTitle?.trim()) {
      bulkResolvedPostTitle = options.optimizePreserveTitle.trim();
      options.onProgress?.(rowIndex, 0, 'Using existing post title for optimize upload');
    } else {
      const entityPlace =
        enrichedRow.entity?.trim() && enrichedRow.entity.trim() !== 'N/A'
          ? enrichedRow.entity.trim()
          : undefined;
      options.onProgress?.(rowIndex, 0, 'Writing post title...');
      bulkResolvedPostTitle = await resolveBulkWordPressPostTitle({
        apiKey: options.openRouterApiKey || loadApiKey(),
        focusKeyword: bulkPrimaryKwResolved,
        entity: entityPlace,
        siteId: pipelineSiteId,
        model: pipelineBlogModel,
        candidates: {
          researchSeoTitle: rankMetaForTitle.seoTitle,
          csvTitle: enrichedRow.title,
          blueprintTitle: blueprintResult.title,
        },
      });
      enrichedRow = { ...enrichedRow, title: bulkResolvedPostTitle };
    }

    const siteBundleList = buildSitesToPostFromPosting(options.wordPressPosting, enrichedRow.entity);
    const primarySiteForAcf = siteBundleList[0]?.site;

    let markdownContent: string;
    let precomputedAcfSeoBundle: PrecomputedAcfSeoBundle | null = null;

    const harnessPromptEnv: HarnessPromptEnv = {
      acfContextOverride: {
        promptModifier: enrichedRow.prompt_modifier?.trim() || undefined,
        keywordFocus: enrichedRow.keyword_focus?.trim() || undefined,
        serviceArea: enrichedRow.service_area_fields?.trim() || undefined,
        seoResearch: serpLlmBriefJson,
      },
      primaryKeyword: bulkPrimaryKwResolved,
      siteId: serpSite?.id ?? connectedSite?.id,
      wordpressSite: serpSite,
      llmAuditSummary: llmAuditSummaryPrompt || undefined,
      dfsArticleAuditBlock: dfsArticleAuditBlock || undefined,
      firstPartyAuthorityBlock: firstPartyAuthorityBlock || undefined,
      llmAuditAuthorityExternalPairs: llmAuditAuthorityLinks.map((link) => ({
        url: link.url,
        anchor: link.anchorText,
      })),
      ...(checklistResult.h2Outline?.length ? { h2Outline: checklistResult.h2Outline } : {}),
      ...(linkTargetsPlan ? { linkTargetsPlan } : {}),
    };

    const runMarkdownPipeline = async (): Promise<string> => {
      options.onProgress?.(rowIndex, 0, 'Generating blog content (harness: one section at a time)...');
      let md = await generateMarkdownContentHarnessed(
        blueprintResult,
        enrichedRow,
        keywordData,
        knowledgeFiles,
        activeKnowledgeBaseText,
        bulkOptions,
        rowIndex,
        connectedSite,
        postsForInternalLinks,
        options.siteSummary,
        semrushKeywordsContext,
        semrushScatterContext,
        rowExternalUrlsForSanitize,
        harnessPromptEnv,
      );

      if (!md || md.trim().length === 0) {
        throw new Error('Markdown content generation returned empty result');
      }

      md = await addEntityLinksToContent(md, enrichedRow, rowIndex, knowledgeFiles, bulkOptions, options.onProgress);
      
      const contentFileName = BulkFileManager.generateFileName(row, 'content', timestamp);
      const contentFileId = BulkFileManager.createFileId(rowIndex, 'content', timestamp);

      const contentFile: BulkGeneratedFile = {
        id: contentFileId,
        rowIndex,
        fileName: contentFileName,
        content: md,
        mimeType: 'text/markdown',
        status: 'completed',
        timestamp,
        rowData: enrichedRow, // Use enriched row with ACF fields
      };

      fileManager.addFile(contentFile);
      generatedFiles.push(contentFile);

      const contentHtml = markdownToHtml(md);
      const contentHtmlFileName = contentFileName.replace(/\.md$/i, ".html");
      const contentHtmlFile: BulkGeneratedFile = {
        id: BulkFileManager.createFileId(rowIndex, "content-html", timestamp),
        rowIndex,
        fileName: contentHtmlFileName,
        content: contentHtml,
        mimeType: "text/html",
        status: "completed",
        timestamp,
        rowData: enrichedRow,
      };
      fileManager.addFile(contentHtmlFile);
      generatedFiles.push(contentHtmlFile);
      const bodyTitles = checklistResult.h2Outline ?? [];
      emitEntitySapPipelineHarnessDone(options, rowIndex, enrichedRow, "Post content", bodyTitles);
      emitEntitySapPipelineHarnessDone(options, rowIndex, enrichedRow, "Content Markdown", bodyTitles);

      options.onProgress?.(rowIndex, 0, 'Markdown content generated successfully');
      return md;
    };

    const scheduleFaqBundlePromise = (): Promise<PrecomputedAcfSeoBundle | null> => {
      const ph = primarySiteForAcf
        ? `${String(primarySiteForAcf.siteUrl).replace(/\/$/, '')}/`
        : '';
      if (!options.wordPressPosting?.enabled || !primarySiteForAcf || !markdownContent?.trim() || !ph) {
        return Promise.resolve(null);
      }
      const rankMeta = resolveRankMathFromKeywordResearch(keywordData);
      const csvMeta = enrichedRow.meta_description?.trim() || "";
      const excerpt =
        csvMeta ||
        precomputedMetaDescription?.trim() ||
        rankMeta.metaDescription ||
        generateExcerpt(markdownContent);
      const primaryKw = bulkPrimaryKwResolved;
      const postTitle = bulkResolvedPostTitle;
      return buildPostMarkdownAcfSeoFaqBundle({
        preBlogSkeleton: preBlogSeoSkeleton,
        markdownContent,
        enrichedRow,
        keywordData,
        blueprintTitle: blueprintResult.title,
        excerpt,
        site: primarySiteForAcf,
        postTitle,
        primaryKw,
        rankMeta,
        openRouterApiKey: options.openRouterApiKey || loadApiKey(),
        placeholderPostUrl: ph,
        onProgress: (msg) => options.onProgress?.(rowIndex, 0, msg),
      }).catch((e: unknown) => {
        console.warn('[Bulk] Precomputed ACF/FAQ bundle failed:', e);
        return null;
      });
    };

    const peerRowLabel = (enrichedRow.title || keywordData.keyword || '').trim();
    const peerMatchKey = useGoogleMaps
      ? entityForImage!
      : (keywordData.keyword || enrichedRow.keyword || '').trim();

    const persistAiFeaturedImageResult = async (
      imageResult: { imageBase64: string },
      imageChecklistUsed: ImageChecklistItem[],
    ) => {
      let imageBase64 = imageResult.imageBase64;
      const mimeType = 'image/png';
      if (imageBase64.includes(',')) {
        imageBase64 = imageBase64.split(',')[1];
      }

      const imageFileName = await generateSEOImageFilename(
        flowTitleForBlueprint,
        options.openRouterApiKey,
        pipelineResearchModel,
        'featured',
      );

      const fileNameWithoutExt = imageFileName.replace(/\.(png|jpg|jpeg)$/i, '');
      const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
      const finalImageFileName = `${fileNameWithoutExt}.${extension}`;

      const imageFileId = BulkFileManager.createFileId(rowIndex, 'image', timestamp);
      const imageFile: BulkGeneratedFile = {
        id: imageFileId,
        rowIndex,
        fileName: finalImageFileName,
        content: `data:${mimeType};base64,${imageBase64}`,
        mimeType,
        status: 'completed',
        timestamp,
        rowData: row,
      };

      fileManager.addFile(imageFile);
      generatedFiles.push(imageFile);

      const featuredImageChecklistFileName = BulkFileManager.generateFileName(
        enrichedRow,
        'featured-image-checklist',
        timestamp,
      );
      const featuredImageChecklistFileId = BulkFileManager.createFileId(
        rowIndex,
        'featured-image-checklist',
        timestamp,
      );

      const featuredImageChecklistFile: BulkGeneratedFile = {
        id: featuredImageChecklistFileId,
        rowIndex,
        fileName: featuredImageChecklistFileName,
        content: JSON.stringify(
          {
            title: flowTitleForBlueprint,
            purpose: flowPurposeResolved,
            keyword: keywordData.keyword,
            entity: enrichedRow.entity,
            imageChecklist: imageChecklistUsed.map((item) => ({
              title: item.title,
              description: item.description,
            })),
            imagePrompt:
              buildImagePrompt(
                {
                  flowTitle: flowTitleForBlueprint,
                  flowPurpose: flowPurposeResolved,
                  agents: blueprintResult.agents,
                  finalOutput: outlineTextForImage,
                },
                {
                  includeText: false,
                  includePeople: false,
                  includeAnimals: false,
                  includeCars: false,
                  isInfographic: false,
                  aspectRatio: '16:9',
                  style: 'professional',
                  colorScheme: 'vibrant',
                },
              ) +
              '\n\nImage Generation Checklist:\n' +
              imageChecklistUsed
                .map((item, idx) => `${idx + 1}. ${item.title}\n   ${item.description}`)
                .join('\n'),
            metadata: {
              aspectRatio: '16:9',
              style: 'professional',
              colorScheme: 'vibrant',
              generatedAt: new Date().toISOString(),
            },
          },
          null,
          2,
        ),
        mimeType: 'application/json',
        status: 'completed',
        timestamp,
        rowData: enrichedRow,
      };

      fileManager.addFile(featuredImageChecklistFile);
      generatedFiles.push(featuredImageChecklistFile);
      options.onProgress?.(rowIndex, 0, 'Featured image checklist JSON generated');
    };

    if (row.featuredImage === 'n') {
      if (options.peerFeaturedReport) {
        recordPeerFeaturedImageOutcome(options.peerFeaturedReport, {
          action: 'none',
          rowIndex,
          rowLabel: peerRowLabel,
        });
      }
    }

    options.onProgress?.(
      rowIndex,
      0,
      useAiImagePath ? 'Blog content + featured image (parallel)...' : 'Generating blog content...',
    );

    const markdownPromise = runMarkdownPipeline();

    const bulkFeaturedImageOptions: ImageGeneratorOptions = {
      userPrompt: (enrichedRow.prompt_modifier || enrichedRow.modifier || '').trim(),
      imageSourceMode: 'featured',
      selectedSection: null,
      includeText: false,
      includePeople: false,
      includeAnimals: false,
      includeCars: false,
      isInfographic: false,
      aspectRatio: '16:9',
      style: 'professional',
      colorScheme: 'vibrant',
      colorForeground: '',
      colorBackground: '',
      imageModel: pipelineImageModel,
    };
    const bulkFeaturedImageContext: ImageGeneratorRunContext = {
      apiKey: options.openRouterApiKey,
      flowTitle: flowTitleForBlueprint,
      flowPurpose: flowPurposeResolved,
      agents: blueprintResult.agents,
      finalOutput: outlineTextForImage,
      selectedModel: pipelineResearchModel,
      temperature: options.temperature ?? 1.0,
      maxTokens: options.maxTokens ?? 4000,
      topP: options.topP ?? 0.9,
      availableSections: [],
    };

    const imagePipelinePromise = useGoogleMaps
      ? Promise.resolve()
      : (async (): Promise<void> => {
      if (row.featuredImage === 'n') return;

      if (options.peerFeaturedReport) {
        recordPeerFeaturedImageOutcome(options.peerFeaturedReport, {
          action: 'generated',
          rowIndex,
          rowLabel: peerRowLabel,
          matchKey: peerMatchKey,
          mode: useGoogleMaps ? 'entity' : 'blog',
          generator: useGoogleMaps ? 'google-maps' : 'ai',
        });
      }

      if (useAiImagePath) {
        options.onProgress?.(rowIndex, 0, 'Image Generator: checklist + featured image...');
        const imageChecklistForRun = await runImageChecklist(
          bulkFeaturedImageOptions,
          bulkFeaturedImageContext,
        );
        if (imageChecklistForRun.length === 0) {
          throw new Error('Image Generator checklist was empty');
        }

        const imageResult = await runFeaturedImage(
          bulkFeaturedImageOptions,
          bulkFeaturedImageContext,
          imageChecklistForRun,
        );
        if (imageResult.error?.trim()) {
          const err = new Error(`Image generation failed: ${imageResult.error.trim()}`);
          options.onError?.(rowIndex, err);
          throw err;
        }
        const imageBase64 =
          imageResult.previewUrl?.trim() ||
          imageResult.imageBase64?.trim() ||
          imageResult.imageUrl?.trim();
        if (!imageBase64) {
          const err = new Error('Image generation returned no image data');
          options.onError?.(rowIndex, err);
          throw err;
        }

        await persistAiFeaturedImageResult({ imageBase64 }, imageChecklistForRun);
      }
    })();

    try {
      if (useGoogleMaps) {
        markdownContent = await markdownPromise;
      } else {
        const [md] = await Promise.all([markdownPromise, imagePipelinePromise]);
        markdownContent = md;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const fromImagePipeline =
        /image grounding|Image generation|Evidence plan|Google Images|featured image/i.test(errorMessage);
      console.error(fromImagePipeline ? 'Error in featured image pipeline:' : 'Error generating markdown content:', error);
      const label = fromImagePipeline ? 'Featured image pipeline failed' : 'Markdown generation failed';
      options.onError?.(rowIndex, new Error(`${label}: ${errorMessage}`));
      throw new Error(`${label}: ${errorMessage}`);
    }

    if (useAiImagePath) {
      const hasFeaturedImageFile = generatedFiles.some((f) => /\.(png|jpe?g)$/i.test(f.fileName));
      if (!hasFeaturedImageFile) {
        throw new Error('Featured image was required but no image file was produced');
      }
    }

    precomputedAcfSeoBundle = await scheduleFaqBundlePromise();

    // WordPress upload (if enabled)
    if (options.wordPressPosting?.enabled && markdownContent) {
      const wpPublish = await publishBulkRowToWordPressSites({
        options,
        rowIndex,
        row,
        enrichedRow,
        markdownContent,
        generatedFiles,
        fileManager,
        timestamp,
        bulkPrimaryKwResolved,
        bulkResolvedPostTitle,
        blueprintResult,
        keywordData,
        postsForInternalLinks,
        rowExplicitExternalPairs,
        pipelineBlogModel,
        precomputedMetaDescription,
        useGoogleMaps,
        entityForImage,
        useAiImagePath,
        precomputedAcfSeoBundle,
        semrushCitationForAcf,
        intelligentMergeForAcf,
        semrushSnapshotForAcf,
        semrushKeywordsContext,
        semrushScatterContext,
        rowExternalUrlsForSanitize,
      });
      if (wpPublish.earlyExit) {
        return generatedFiles;
      }
    }
    return generatedFiles;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}
