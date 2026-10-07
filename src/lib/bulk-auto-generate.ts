import { buildFocusedArticlePurpose } from "@/lib/content-generation/article-length-policy";
import { parseImportedLinksJson, parseImportedSectionsJson, parseModifierLinksJson } from './bulk/bulk-csv-parser';
import { importedBodyH2Outline } from './bulk/blog-import-parser';
import {
  injectImportedLinksIntoBlueprintAgents,
  injectImportedLinksIntoChecklist,
  type ImportedDraftLink,
} from './bulk/blog-import-draft-links';
import {
  injectEntityWikipediaIntoBlueprintAgents,
  injectEntityWikipediaIntoChecklist,
} from './bulk/entity-wikipedia-prompt';
import {
  injectModifierExternalLinksIntoBlueprintAgents,
  injectModifierExternalLinksIntoChecklist,
  injectLlmAuditAuthorityLinksIntoBlueprintAgents,
  injectLlmAuditAuthorityLinksIntoChecklist,
  researchModifierExternalLinks,
  type ModifierExternalLink,
} from './bulk/modifier-external-links';
import {
  enforceForbiddenWordsOnBlueprint,
  formatBlueprintFileContent,
  formatChecklistFileContent,
  GLOBAL_FORBIDDEN_WORDS_PROMPT_BLOCK,
  prepareChecklistForPipeline,
} from '@/lib/content-word-blocklist';
import {
  formatPrefilledBulkRowContractFromCsvRow,
  hasCsvFilledMeta,
  hasCsvFilledWikipediaUrl,
} from './bulk/prefilled-bulk-row-contract';
import { generateChecklistFromSelections, generateBlueprintFromTemplate, type BlogTemplateContext } from './blog-template-builder';
import {
  getImageModel,
  getProductionModel,
  getResearchModel,
} from './optimization-settings-storage';
import { buildImagePrompt } from './image-prompt-builder';
import type { ImageChecklistItem } from './image-checklist-builder';
import { generateSEOImageFilename } from './image-filename-generator';
import type { KeywordData, KeywordAIAnalysis, KeywordAnalysisComplete, KeywordAnalysisOptions } from './keyword-types';
import { BulkFileManager, type BulkGeneratedFile } from './bulk-file-manager';
import type { WordPressSite } from '@/components/integrations/types';
import {
  createWordPressPost,
  updateWordPressPost,
  uploadWordPressMedia,
  updateWordPressPostMeta,
} from './wordpress-api';
import {
  fetchGoogleMapsImageForEntity,
  fetchGoogleMapsImageForEntityWithFallback,
  peekGoogleMapsImageCache,
} from './content-generation/google-maps-image-api';
import {
  generateDirectFeaturedImagePayload,
  uploadDirectFeaturedMedia,
} from './bulk/blog-import-direct-extras';
import {
  buildContentOptimizeHarnessPayload,
  buildGoogleImageEntitySapPipelineTitles,
  buildContentOptimizePipelineTitles,
  extractBodyHarnessTitlesFromRowFiles,
  rowUsesGoogleImageFeatured,
} from './overview/overview-content-optimize-pipeline';
import { wpUploadHarnessGeneratedFiles } from './overview/overview-wp-upload-harness-artifacts';
import {
  recordPeerFeaturedImageOutcome,
  type PeerFeaturedImageReportCollector,
} from './bulk/peer-featured-image-report';
import type { PeerFeaturedLibraryCsvFile } from './overview/sap-peer-featured-image-search';
import {
  getSapMapsMediaId,
  sapMapsImageFileName,
  setSapMapsMediaId,
  type SapMapsMediaBank,
} from './bulk/sap-maps-media-bank';
import { markdownToHtml, generateExcerpt } from './markdown-to-html';
import {
  formatWordPressDate,
  resolveBulkWordPressPublishDate,
  resolveWordPressPostStatusForSchedule,
} from './wordpress-scheduler';
import { sanitizeWordPressSlugSegment } from './rank-math-redirect-csv';
import { buildSapSlugFromKeywordEntity } from '@/lib/sap-slug-from-keyword-entity';
import { extractOriginFromSapTitle } from '@/lib/sap-origin-from-title';
import { extractEndpointFromEntitySitemapUrl } from './entity-endpoint-extractor';
import { resolveUploadSitemapType } from '@/lib/bulk/bulk-sitemap-mode';
import { updateACFFields } from './wordpress-acf-origin';
import { getACFFieldsForPost, resolveAcfFieldsForMapping } from '@/lib/wordpress-api/acf-discovery';
import { discoverACFFieldMapping, fallbackFieldMapping } from '@/lib/content-generation/acf-field-mapper';
import { mergeSeoResearchWithMeta, buildAcfPayload } from '@/lib/content-generation/apply-meta-acf-payload';
import type { OptimizedMetaFields } from '@/lib/meta-field-optimizer';
import { buildOptimizedMetaFromKeywordResearch } from '@/lib/content-generation/apply-bulk-meta-from-seo-json';
import {
  buildFAQSchemaScriptFromEntries,
} from './content-generation/wordpress-uploader';
import {
  generateBulkFaqEntriesInContext,
  napLocationsFromSite,
} from '@/lib/content-generation/bulk-faq-in-context';
import { parseFaqEntries, type FaqEntry } from '@/lib/faq-entries';
import { appendVisibleFaqTableWithIntro, FLO_FAQ_CLASS, stripTrailingFaqSection } from '@/lib/overview/overview-blog-faq-append';
import {
  buildPreBlogSeoResearchSkeleton,
  mergeBlueprintIntoPreBlogSkeleton,
  buildPostMarkdownAcfSeoFaqBundle,
  patchPostLinkInSeoResearchJson,
  resolveFaqEntriesForVisibleTable,
  type PrecomputedAcfSeoBundle,
} from '@/lib/content-generation/bulk-acf-seo-bundle';
import { generateMetaDescription } from '@/lib/content-generation/content-generator';
import { resolveBulkWordPressPostTitle } from '@/lib/bulk/bulk-post-title-agent';
import {
  sanitizeContentForUpload,
} from './content-generation/content-sanitizer';
import { prepareHarnessContentForUpload } from './content-generation/harness-upload-prep';
import { ensureWhatWeOfferTablePageLinks } from './content-generation/what-we-offer-table-page-links';
import {
  buildRowExplicitExternalAllowlist,
  externalUrlsFromPairs,
} from './content-generation/external-link-placeholders';
import { generateSEOSlug } from './seo-slug-generator';
import { loadApiKey } from './api';
import {
  fetchSemrushBulkEnrichment,
  type SemrushBulkEnrichmentResult,
} from './wordpress-api/semrush';
import type { IntelligentKeywordResearchMergeResult } from './bulk/intelligent-keyword-research-merge';
import { buildSemrushKeywordsRagJson } from './semrush-keywords-rag';
import { buildSemrushClusterScatterPlan, buildSemrushScatterContextJson } from './semrush-cluster-scatter';
import { resolveRecommendedAuthor } from './wordpress-api/author-resolver';
import {
  fetchSeoContentBriefWave,
  resolveSerpLocationName,
} from '@/lib/llm-audit/fetch-seo-content-brief-wave';
import { mergeSeoBriefIntoBulkSkeleton } from '@/lib/llm-audit/fetch-merged-seo-content-brief';
import { llmAuditGuidanceFromBrief } from '@/lib/llm-audit/llm-audit-dataforseo';
import { resolveSiteLocationLabel } from '@/lib/llm-audit/resolve-site-location-label';
import type { SeoContentBriefV1 } from '@/lib/overview-seo-content-brief';
import { runTopicResearchFanout } from '@/lib/content-optimization/topic-research-fanout';
import {
  firstPartyAuthorityBlockFromBrief,
  swotTextFromResearchFields,
} from '@/lib/content-optimization/first-party-authority-prompt';
import { resolveLlmAuditAuthorityLinksForChecklist } from '@/lib/llm-audit/llm-audit-authority-links';
import {
  loadWorkflowSerpResearchBrief,
  parseSeoContentBriefFromRow,
} from '@/lib/workflow/workflow-serp-research-cache';
import { loadWorkflowDfsArticleAudit } from '@/lib/workflow/workflow-dfs-article-audit-cache';
import { formatDfsArticleAuditHarnessPromptBlock } from '@/lib/dfs-article-audit/format-dfs-article-audit-harness';
import { acfOriginAppliesForSitemapType } from '@/lib/acf-origin-applies';

function bulkRowSerpGeoText(row: {
  title?: string;
  keyword?: string;
  modifier?: string;
  prompt_modifier?: string;
}): string {
  return [row.title, row.keyword, row.prompt_modifier, row.modifier].filter(Boolean).join(' ');
}

function bulkRowSerpLocationName(row: {
  title?: string;
  keyword?: string;
  modifier?: string;
  prompt_modifier?: string;
}): string {
  return resolveSerpLocationName('', bulkRowSerpGeoText(row));
}
// Import from new feature-based modules
import type {
  BulkHarnessSectionPayload,
  BulkProcessingOptions,
  BulkProcessingResult,
  PrefetchedBulkKeywordResearch,
  WordPressPostDestination,
  WordPressPostingOptions,
} from './bulk/bulk-auto-generate-types';
import type { CSVRow } from './bulk/bulk-csv-parser';
import { resolveBulkPrimaryKeyword } from './bulk/bulk-primary-keyword';
import { buildBlogImportKeywordResearchStub } from './bulk/blog-import-parse';
import { parseCSV, parseBlogIdeasChecklist } from './bulk/bulk-csv-parser';
import {
  autoSelectKeywords,
  autoSelectH2Sections,
  autoSelectPeopleAlsoAsk,
} from './bulk/bulk-blueprint-generator';
import { 
  generateMarkdownContentHarnessed,
  addEntityLinksToContent,
  type HarnessPromptEnv,
} from './bulk/bulk-content-generator';
import { generateImageChecklist } from './bulk/bulk-image-generator';
import { runFeaturedImage } from '@/lib/image-generator/run-featured-image';
import { runImageChecklist } from '@/lib/image-generator/run-image-checklist';
import type {
  ImageGeneratorOptions,
  ImageGeneratorRunContext,
} from '@/lib/image-generator/image-generator-options';
import { generateEntityTitleFromSitemap } from './bulk/bulk-entity-handler';
import type { RunHistoryEntry } from '@/hooks/content-optimization/use-optimization-state';
import { validateAndStripInvalidLinksFromContent } from './wordpress-api/validate-internal-links';
import {
  keepBlogPlayLinkTargets,
  inventoryRowsToWordPressLinkables,
  type LinkTargetsPlan,
} from './bulk/bulk-generation-wp-inventory';
import { getBulkGenerationWpInventoryIfReady } from './bulk/bulk-generation-inventory-cache-store';
import type { ExtraTextInventoryLinkRow } from './content-generation/extra-text-inventory-links';
import { runContentLinkTargetsHarness } from './overview/overview-content-link-targets-harness-run';
import { OptimizationFileManager } from './optimization-file-manager';
import {
  parseOptimizedMetaFromSeoResearchJson,
  populateACFFieldsFromDFS,
} from '@/lib/bulk/bulk-row-acf-meta';
import {
  buildSitesToPostFromPosting,
  clearBulkUploadValidationCache,
  getBulkPreValidatedUrlsForSite,
  prefetchBulkWordPressLinkValidationForRun,
} from '@/lib/bulk/bulk-wordpress-link-prefetch';
import {
  buildBulkSelectedKeywordArtifactPayload,
  mergeSemrushFieldsIntoSeoResearchJson,
  resolveRankMathFromKeywordResearch,
  safeTrimSemrushOverviewForAcf,
} from '@/lib/bulk/bulk-keyword-research-artifacts';

export {
  buildSitesToPostFromPosting,
  prefetchBulkWordPressLinkValidationForRun,
  clearBulkUploadValidationCache,
} from '@/lib/bulk/bulk-wordpress-link-prefetch';
export {
  buildBulkSelectedKeywordArtifactPayload,
  resolveRankMathFromKeywordResearch,
} from '@/lib/bulk/bulk-keyword-research-artifacts';

type BulkInternalLinkRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
  collection?: string;
  postType?: string;
};

function bulkPostsToExtraTextLinkRows(posts: BulkInternalLinkRow[]): ExtraTextInventoryLinkRow[] {
  return posts.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    link: item.link,
    date_gmt: item.date_gmt,
    postType:
      item.collection === "pages" || item.postType === "page" ? ("page" as const) : ("post" as const),
  }));
}

function emitBulkPipelineHarnessDoneByTitle(
  options: BulkProcessingOptions,
  rowIndex: number,
  stepTitle: string,
  pipelineTitles: readonly string[],
): void {
  const sectionIndex = pipelineTitles.findIndex((title) => title === stepTitle);
  if (sectionIndex < 0) return;
  options.onHarnessSection?.(
    buildContentOptimizeHarnessPayload(rowIndex, sectionIndex, "done", undefined, pipelineTitles),
  );
}

export function emitEntitySapPipelineHarnessDone(
  options: BulkProcessingOptions,
  rowIndex: number,
  row: Pick<CSVRow, "featuredImage">,
  stepTitle: string,
  bodyHarnessTitles?: readonly string[],
): void {
  if (!rowUsesGoogleImageFeatured(row, options.featuredImageType)) return;
  emitBulkPipelineHarnessDoneByTitle(
    options,
    rowIndex,
    stepTitle,
    buildGoogleImageEntitySapPipelineTitles(bodyHarnessTitles ?? []),
  );
}

// Re-export types and functions for backward compatibility
export type { CSVRow } from './bulk/bulk-csv-parser';
export { parseCSV, parseCsvStatic, parseBlogIdeasChecklist } from './bulk/bulk-csv-parser';
export { generateEntityTitleFromSitemap } from './bulk/bulk-entity-handler';

export type {
  WordPressPostDestination,
  WordPressPostingOptions,
  BulkHarnessSectionPayload,
  BulkProcessingOptions,
  BulkProcessingResult,
  PrefetchedBulkKeywordResearch,
} from './bulk/bulk-auto-generate-types';
export {
  BULK_POST_DESTINATION_CHOICES,
  BLOG_IMPORT_POST_DESTINATION_CHOICES,
  WORDPRESS_POST_DESTINATION_SHORT,
  WORDPRESS_POST_DESTINATION_LONG,
} from './bulk/bulk-auto-generate-types';

/**
 * Process a single row and generate all outputs
 */
export async function generateRowOutputs(
  rowIndex: number,
  row: CSVRow,
  options: BulkProcessingOptions,
  fileManager: BulkFileManager,
  analyzeKeywordFn: (
    keyword: string,
    analysisOptions: KeywordAnalysisOptions,
  ) => Promise<KeywordAnalysisComplete | null>,
): Promise<{ files: BulkGeneratedFile[]; research: KeywordAnalysisComplete | null }> {
  const timestamp = Date.now();
  const generatedFiles: BulkGeneratedFile[] = [];

  try {
    // Step 1: Fetch Wikipedia content only when entity is set and CSV did not already provide wikipedia_url
    if (
      !options.skipWikipediaLookup
      && row.entity
      && row.entity.trim()
      && !hasCsvFilledWikipediaUrl(row)
    ) {
      options.onProgress?.(rowIndex, 0, `Fetching Wikipedia content for "${row.entity}"...`);

      try {
        // First verify the entity exists on Wikipedia
        const { checkWikipediaPageExists } = await import('./wikipedia-api');
        const entityCheck = await checkWikipediaPageExists(row.entity.trim());
        
        if (!entityCheck.exists) {
          console.warn(`[Bulk Generator] Entity "${row.entity}" does not exist on Wikipedia. Skipping Wikipedia content fetch.`);
          options.onProgress?.(rowIndex, 0, `Entity "${row.entity}" not found on Wikipedia, skipping...`);
        } else {
          // Fetch Wikipedia content with retry logic
          let wikipediaChunks: any[] = [];
          let retries = 3;
          let lastError: Error | null = null;
          
          while (retries > 0) {
            try {
              const { fetchWikipediaContent } = await import('./wikipedia-api');
              wikipediaChunks = await fetchWikipediaContent(row.entity.trim());
              break; // Success
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              retries--;
              
              if (retries === 0) {
                console.error(`[Bulk Generator] Failed to fetch Wikipedia content for "${row.entity}" after retries:`, lastError);
                // Don't throw - continue without Wikipedia content
                options.onProgress?.(rowIndex, 0, `Failed to fetch Wikipedia content for "${row.entity}", continuing without it...`);
              } else {
                // Wait before retry (exponential backoff)
                const delay = 1000 * (4 - retries);
                options.onProgress?.(rowIndex, 0, `Retrying Wikipedia fetch for "${row.entity}" (${4 - retries}/3)...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          }
          
          if (wikipediaChunks.length > 0) {
            const { generateWikipediaCSV } = await import('./wikipedia-api');
            const wikipediaCSV = generateWikipediaCSV(wikipediaChunks);
            const wikipediaFileName = BulkFileManager.generateFileName(row, 'wikipedia', timestamp);
            const wikipediaFileId = BulkFileManager.createFileId(rowIndex, 'wikipedia', timestamp);
            
            const wikipediaFile: BulkGeneratedFile = {
              id: wikipediaFileId,
              rowIndex,
              fileName: wikipediaFileName,
              content: wikipediaCSV,
              mimeType: 'text/csv',
              status: 'completed',
              timestamp,
              rowData: row,
            };
            
            fileManager.addFile(wikipediaFile);
            generatedFiles.push(wikipediaFile);
            options.onProgress?.(rowIndex, 0, `Wikipedia content fetched for "${row.entity}" (${wikipediaChunks.length} chunks)`);
          } else if (entityCheck.exists) {
            console.warn(`[Bulk Generator] Wikipedia page exists for "${row.entity}" but no content chunks were extracted.`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Bulk Generator] Error fetching Wikipedia content for "${row.entity}":`, errorMessage);
        // Continue without Wikipedia content - don't fail the entire generation
        options.onProgress?.(rowIndex, 0, `Error fetching Wikipedia content for "${row.entity}", continuing without it...`);
      }
    } else if (hasCsvFilledWikipediaUrl(row)) {
      options.onProgress?.(rowIndex, 0, `Using CSV wikipedia_url; skipping Wikipedia KB fetch`);
    }

    const skipKeywordResearch = Boolean(options.openRouterOnly);

    if (skipKeywordResearch) {
      options.onProgress?.(rowIndex, 0, 'OpenRouter generation...');
      return { files: generatedFiles, research: null };
    }

    const csvKeyword = row.keyword?.trim();
    if (!csvKeyword) {
      throw new Error('CSV row missing keyword');
    }

    const buildCsvKeywordResearch = (): KeywordAnalysisComplete => {
      const stub = buildBlogImportKeywordResearchStub(row);
      return {
        result: {
          primaryKeyword: stub.primaryKeyword,
          keywordData: stub.keywordData,
          semanticKeywords: [],
          searchIntent: stub.keywordData.intent || 'informational',
        },
        aiAnalysis: stub.aiAnalysis,
        keywordsVolumeData: [],
        paaRawResponse: null,
      };
    };

    options.onProgress?.(rowIndex, 0, 'Running keyword research...');
    let research: KeywordAnalysisComplete | null = null;
    try {
      research = await analyzeKeywordFn(csvKeyword, {
        location: bulkRowSerpLocationName(row),
        language: 'en',
        strict: false,
      });
    } catch (err) {
      console.warn('[Bulk Generator] DataForSEO keyword research failed, using CSV keyword:', err);
    }

    if (!research?.result?.keywordData || !research.aiAnalysis) {
      research = buildCsvKeywordResearch();
    } else {
      research = {
        ...research,
        result: {
          ...research.result,
          primaryKeyword: csvKeyword,
          keywordData: {
            ...research.result.keywordData,
            keyword: csvKeyword,
          },
        },
      };
    }

    return { files: generatedFiles, research };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    options.onError?.(rowIndex, error instanceof Error ? error : new Error(errorMessage));
    throw error;
  }
}

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

  const sitesToPostForTemplate = buildSitesToPostFromPosting(options.wordPressPosting);
  const rowEntity = enrichedRow.entity?.trim() ?? "";
  const hasRowEntity = Boolean(rowEntity && rowEntity !== "N/A");
  const useEntitySitemapTemplate =
    hasRowEntity &&
    (enrichedRow.sitemap_type === "entity" ||
      sitesToPostForTemplate.some((s) => s.sitemapType === "entity") ||
      options.useEntitySitemapTemplate === true);
  const entityForLocalTemplate = hasRowEntity ? rowEntity : undefined;
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
    
    const selectedKeywords = autoSelectKeywords(aiAnalysis, keywordsWithVolumeData);
    const selectedH2Sections = autoSelectH2Sections(aiAnalysis);
    const selectedPeopleAlsoAsk = autoSelectPeopleAlsoAsk(aiAnalysis);
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
    const importedDraftLinks: ImportedDraftLink[] =
      parseImportedLinksJson(enrichedRow.imported_links_json ?? row.imported_links_json) ?? [];
    const importedSections = options.updateTargetPostId != null
      ? undefined
      : parseImportedSectionsJson(enrichedRow.imported_sections_json ?? row.imported_sections_json);
    const importedH2Outline = importedBodyH2Outline(importedSections);

    const modifierUrls =
      parseModifierLinksJson(enrichedRow.modifier_links_json ?? row.modifier_links_json)?.map(
        (link) => link.url,
      ) ?? [];
    let modifierExternalLinks: ModifierExternalLink[] = [];
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

    let rowExplicitExternalPairs = buildRowExplicitExternalAllowlist({
      modifierExternalLinks,
      importedDraftLinks,
    });
    rowExternalUrlsForSanitize = externalUrlsFromPairs(rowExplicitExternalPairs);

    const prefilledRowContract = formatPrefilledBulkRowContractFromCsvRow(enrichedRow);

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
    const serpSite = sitesToPostForTemplate[0]?.site;
    const pipelineSiteId = serpSite?.id;
    const pipelineResearchModel =
      options.selectedModel?.trim() || getResearchModel(pipelineSiteId);
    const pipelineBlogModel = getProductionModel(pipelineSiteId);
    const pipelineImageModel = getImageModel(pipelineSiteId);
    const serpBaseUrl =
      serpSite?.siteUrl?.replace(/\/+$/, '') ||
      connectedSite?.siteUrl?.replace(/\/+$/, '') ||
      '';
    const serpSlug = serpKeyword ? generateSEOSlug(serpKeyword) : '';
    const destinationPageUrl = enrichedRow.destination_url?.trim() || row.destination_url?.trim() || "";
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

    const llmOkCount = serpLlmBrief.llmAudit?.platforms.filter((p) => p.status === "ok").length ?? 0;
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
    const firstPartyAuthorityBlock = firstPartyAuthorityBlockFromBrief(serpLlmBrief, swotText);

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

    const selectedResearchLinks = [
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

    const llmAuditSummaryPrompt = llmAuditGuidanceFromBrief(serpLlmBrief);
    const workflowDfsOutputs =
      options.workflowDfsArticleAudit?.getOutputs?.()
      ?? options.workflowDfsArticleAudit?.outputs;
    const cachedWorkflowArticleAudit = workflowDfsOutputs?.length
      ? await loadWorkflowDfsArticleAudit(workflowDfsOutputs, serpPageUrl)
      : null;
    const dfsArticleAuditBlock = cachedWorkflowArticleAudit?.audit
      ? formatDfsArticleAuditHarnessPromptBlock(cachedWorkflowArticleAudit.audit)
      : "";
    const serpLlmBriefJson = JSON.stringify(serpLlmBrief, null, 2);
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

    const siteBundleList = buildSitesToPostFromPosting(options.wordPressPosting);
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
      // Determine which sites to post to
      const sitesToPost: Array<{ site: WordPressSite; sitemapType: 'post' | 'entity' }> = [];
      
      if (options.wordPressPosting.sites && options.wordPressPosting.sites.length > 0) {
        sitesToPost.push(
          ...options.wordPressPosting.sites.map((s) => ({
            site: s.site,
            sitemapType: resolveUploadSitemapType(s.sitemapType, enrichedRow.entity),
          })),
        );
      } else if (options.wordPressPosting.site) {
        sitesToPost.push({
          site: options.wordPressPosting.site,
          sitemapType: resolveUploadSitemapType(
            options.wordPressPosting.sitemapType,
            enrichedRow.entity,
          ),
        });
      }

      if (sitesToPost.length === 0) {
        const msg =
          'WordPress upload skipped: posting was enabled but no target sites were resolved. Check Integrations (saved site + app password) and bulk WordPress settings.';
        console.warn('[WordPress]', msg);
        options.onError?.(rowIndex, new Error(msg));
        return generatedFiles;
      }

      const scheduleSlotIndex = options.bulkScheduleSlotIndex ?? rowIndex;

      // Scheduled date for this row (shared across all sites): CSV `publish_date_gmt` when valid, else frequency-based
      const scheduleOpts = {
        frequency: options.wordPressPosting.frequency,
        customInterval: options.wordPressPosting.customInterval,
        customStaggerOptimized: options.wordPressPosting.customStaggerOptimized,
        dayOfWeek: options.wordPressPosting.dayOfWeek,
        startDate: options.wordPressPosting.startDate,
        startTime: options.wordPressPosting.startTime,
        totalRows: options.wordPressPosting.totalRows,
        useGapScheduling: options.wordPressPosting.useGapScheduling,
        scheduleOccupancy: options.wordPressPosting.scheduleOccupancy,
        publishDays: options.wordPressPosting.publishDays,
      };
      const gapSlotDate = options.wordPressPosting.gapDatesBySlot?.[scheduleSlotIndex];
      const useCsvPublishDates = options.wordPressPosting.useCsvPublishDates !== false;
      let scheduledDate: Date;
      let bulkPublishDateSource: import('@/lib/wordpress-scheduler').BulkPublishDateSource;
      if (useCsvPublishDates) {
        const resolved = resolveBulkWordPressPublishDate({
          rowPublishDateGmt: enrichedRow.publish_date_gmt ?? row.publish_date_gmt,
          rowIndex: scheduleSlotIndex,
          schedule: scheduleOpts,
          useCsvPublishDates: true,
        });
        if (resolved.source === 'csv') {
          scheduledDate = resolved.date;
          bulkPublishDateSource = resolved.source;
        } else if (gapSlotDate) {
          scheduledDate = gapSlotDate;
          bulkPublishDateSource = 'calculated';
        } else {
          scheduledDate = resolved.date;
          bulkPublishDateSource = resolved.source;
        }
      } else if (gapSlotDate) {
        scheduledDate = gapSlotDate;
        bulkPublishDateSource = 'calculated';
      } else {
        const resolved = resolveBulkWordPressPublishDate({
          rowPublishDateGmt: enrichedRow.publish_date_gmt ?? row.publish_date_gmt,
          rowIndex: scheduleSlotIndex,
          schedule: scheduleOpts,
          useCsvPublishDates: false,
        });
        scheduledDate = resolved.date;
        bulkPublishDateSource = resolved.source;
      }
      const firstSite = sitesToPost[0]?.site;
      const uploadBaseUrl = firstSite?.siteUrl?.replace(/\/+$/, "") ?? "";
      let uploadPageUrl = enrichedRow.destination_url?.trim() ?? "";
      if (!uploadPageUrl && uploadBaseUrl && options.useEntitySitemapTemplate) {
        const kw = (bulkPrimaryKwResolved || enrichedRow.keyword || "").trim();
        const ent =
          enrichedRow.entity?.trim() && enrichedRow.entity.trim() !== "N/A"
            ? enrichedRow.entity.trim()
            : "";
        const slugEarly = buildSapSlugFromKeywordEntity(kw, ent);
        if (slugEarly) uploadPageUrl = `${uploadBaseUrl}/${slugEarly}`;
      }
      options.onProgress?.(rowIndex, 0, 'Quality control: checking HTML...');
      options.onProgress?.(rowIndex, 0, 'Preparing harness content for upload...');
      let htmlContent = await prepareHarnessContentForUpload({
        markdownContent,
        blueprintAgents: blueprintResult.agents,
        wordPressPosts: postsForInternalLinks,
        postsForInternalLinks,
        siteId: firstSite?.id,
        siteUrl: firstSite?.siteUrl,
        currentPageUrl: uploadPageUrl || undefined,
        externalUrlPairs: rowExplicitExternalPairs,
        apiKey: options.openRouterApiKey || loadApiKey(),
        keyword: bulkPrimaryKwResolved,
        articleTitle: bulkResolvedPostTitle,
        model: pipelineBlogModel,
      });
      if (options.wordPressPagesForOfferTable?.length && firstSite?.siteUrl) {
        htmlContent = ensureWhatWeOfferTablePageLinks(
          htmlContent,
          options.wordPressPagesForOfferTable,
          uploadPageUrl || firstSite.siteUrl,
          firstSite.siteUrl,
        );
      }
      const rankMeta = resolveRankMathFromKeywordResearch(keywordData);
      // Prefer CSV meta when filled; then generator meta; then research / body
      const csvMeta = enrichedRow.meta_description?.trim() || "";
      const excerpt =
        csvMeta ||
        precomputedMetaDescription?.trim() ||
        rankMeta.metaDescription ||
        generateExcerpt(markdownContent);

      const bulkPrimaryKw = bulkPrimaryKwResolved;

      let featuredImageId: number | undefined;
      let featuredImageLink: string | null = null;
      let directFeaturedPayload: { imageBase64: string; filename: string } | undefined;
      let imageFile: { fileName: string; content: string } | undefined;

      if (useGoogleMaps && entityForImage) {
        if (options.googleMapsImagePromise) {
          await options.googleMapsImagePromise;
        }
        let mapsPayload =
          peekGoogleMapsImageCache(entityForImage) ??
          (await fetchGoogleMapsImageForEntityWithFallback(
            entityForImage,
            options.googleMapsImageSerpLocation,
          ));
        const bank = options.sapMapsMediaBank;
        const firstSite = sitesToPost[0].site;
        featuredImageId = bank ? getSapMapsMediaId(bank, firstSite.id, entityForImage) : undefined;
        if (featuredImageId == null && mapsPayload?.imageBase64?.trim()) {
          const extension = mapsPayload.mimeType === "image/jpeg" ? "jpg" : "png";
          directFeaturedPayload = {
            imageBase64: mapsPayload.imageBase64,
            filename: sapMapsImageFileName(entityForImage, extension),
          };
          const uploaded = await uploadDirectFeaturedMedia({
            site: firstSite,
            imageBase64: directFeaturedPayload.imageBase64,
            filename: directFeaturedPayload.filename,
            title: enrichedRow.title || blueprintResult.title || entityForImage,
            keyword: bulkPrimaryKw || entityForImage,
          });
          featuredImageId = uploaded.mediaId;
          featuredImageLink = uploaded.url;
          if (bank) {
            setSapMapsMediaId(bank, firstSite.id, entityForImage, featuredImageId);
          }
        }
      } else {
        const aiImageFile = generatedFiles.find(
          (f) =>
            f.fileName.endsWith('.png') ||
            f.fileName.endsWith('.jpg') ||
            f.fileName.endsWith('.jpeg'),
        );
        if (useAiImagePath && !aiImageFile?.content) {
          throw new Error('Featured image was required but no image file was available for upload');
        }
        if (aiImageFile?.content && sitesToPost[0]?.site) {
          imageFile = { fileName: aiImageFile.fileName, content: aiImageFile.content };
          try {
            options.onProgress?.(rowIndex, 0, 'Uploading featured image to WordPress...');
            let imageBase64 = aiImageFile.content;
            if (imageBase64.startsWith('data:')) {
              imageBase64 = imageBase64.split(',')[1];
            }
            const mediaTitle = enrichedRow.title || blueprintResult.title;
            const mediaResult = await uploadWordPressMedia(
              sitesToPost[0].site.siteUrl,
              sitesToPost[0].site.username,
              sitesToPost[0].site.appPassword,
              imageBase64,
              aiImageFile.fileName,
              mediaTitle,
              undefined,
            );
            if (mediaResult.success && mediaResult.mediaId) {
              featuredImageId = mediaResult.mediaId;
              options.onProgress?.(rowIndex, 0, `Featured image uploaded: Media ID ${featuredImageId}`);
            } else {
              options.onError?.(rowIndex, new Error('WordPress media upload failed'));
            }
          } catch (error) {
            options.onError?.(rowIndex, error instanceof Error ? error : new Error(String(error)));
          }
        }
      }

      const needsEntityWiki = sitesToPost.some((s) => s.sitemapType === 'entity');
      let entityWikiForSanitize: { url: string; label: string } | undefined;
      if (
        needsEntityWiki &&
        enrichedRow.entity?.trim() &&
        enrichedRow.entity.trim() !== 'N/A'
      ) {
        const url = enrichedRow.wikipedia_url?.trim();
        if (url) {
          entityWikiForSanitize = { url, label: enrichedRow.entity.trim() };
        }
      }

      // Post to all selected sites
      for (let siteIndex = 0; siteIndex < sitesToPost.length; siteIndex++) {
        const { site, sitemapType } = sitesToPost[siteIndex];
        
        try {
          options.onProgress?.(rowIndex, 0, `Uploading to WordPress (${site.name})...`);

          // Always attempt upload for each row. (We no longer skip when an entity label appears in the entity
          // sitemap - titles/slugs differ per post; users asked to never skip scheduled rows for that reason.)

          // Determine entity endpoint based on sitemapType
          let entityEndpoint: string;
          if (sitemapType === 'entity' && site.entitySitemapUrl) {
            entityEndpoint = extractEndpointFromEntitySitemapUrl(site.entitySitemapUrl);
          } else {
            entityEndpoint = 'posts';
          }

          let siteFeaturedImageId = featuredImageId;
          if (siteIndex > 0 && useGoogleMaps && entityForImage) {
            const bank = options.sapMapsMediaBank;
            siteFeaturedImageId = bank ? getSapMapsMediaId(bank, site.id, entityForImage) : undefined;
            if (siteFeaturedImageId == null) {
              let payload = directFeaturedPayload;
              if (!payload) {
                const mapsPayload =
                  peekGoogleMapsImageCache(entityForImage) ??
                  (await fetchGoogleMapsImageForEntityWithFallback(
                    entityForImage,
                    options.googleMapsImageSerpLocation,
                  ));
                if (mapsPayload?.imageBase64?.trim()) {
                  const extension = mapsPayload.mimeType === "image/jpeg" ? "jpg" : "png";
                  payload = {
                    imageBase64: mapsPayload.imageBase64,
                    filename: sapMapsImageFileName(entityForImage, extension),
                  };
                }
              }
              if (payload) {
                const uploaded = await uploadDirectFeaturedMedia({
                  site,
                  imageBase64: payload.imageBase64,
                  filename: payload.filename,
                  title: enrichedRow.title || blueprintResult.title || entityForImage,
                  keyword: bulkPrimaryKw || entityForImage,
                });
                siteFeaturedImageId = uploaded.mediaId;
                if (!featuredImageLink) featuredImageLink = uploaded.url;
                if (bank) {
                  setSapMapsMediaId(bank, site.id, entityForImage, siteFeaturedImageId);
                }
              }
            }
          } else if (siteIndex > 0 && imageFile?.content) {
            let imageBase64 = imageFile.content;
            if (imageBase64.startsWith('data:')) {
              imageBase64 = imageBase64.split(',')[1];
            }
            const mediaTitle = enrichedRow.title || blueprintResult.title;
            const mediaResult = await uploadWordPressMedia(
              site.siteUrl,
              site.username,
              site.appPassword,
              imageBase64,
              imageFile.fileName,
              mediaTitle,
              undefined,
            );
            if (!mediaResult.success || !mediaResult.mediaId) {
              throw new Error('WordPress media upload failed');
            }
            siteFeaturedImageId = mediaResult.mediaId;
          }

          const postTitle = bulkResolvedPostTitle;

          let slug: string | undefined;
          const optimizeSlug = sanitizeWordPressSlugSegment(options.optimizePreserveSlug ?? "");
          if (optimizeSlug.length >= 2) {
            slug = optimizeSlug;
          } else {
          const lockedSlug = sanitizeWordPressSlugSegment(enrichedRow.target_slug ?? "");
          if (lockedSlug.length >= 2) {
            slug = lockedSlug;
          } else if (sitemapType === "entity") {
            const kw = (bulkPrimaryKw || enrichedRow.keyword || "").trim();
            const ent =
              enrichedRow.entity?.trim() && enrichedRow.entity.trim() !== "N/A"
                ? enrichedRow.entity.trim()
                : "";
            slug = buildSapSlugFromKeywordEntity(kw, ent);
            if (!slug || slug.length < 2) slug = undefined;
          } else {
            throw new Error(
              "Blog row is missing target_slug. Regenerate Ideas so the URL slug agent can set the permalink.",
            );
          }
          }

          const wpPostStatus = options.wordPressPosting.draftOnly
            ? ('draft' as const)
            : resolveWordPressPostStatusForSchedule(scheduledDate);
          const contractDestination = enrichedRow.destination_url?.trim();

          let authorId: number | undefined;
          try {
            authorId = await resolveRecommendedAuthor({
              site,
              postTypeEndpoint: entityEndpoint,
              apiKey: options.openRouterApiKey || loadApiKey(),
              siteId: site.id,
            });
          } catch {
            authorId = undefined;
          }

          // Sanitize: remove invalid internal links (not in WordPress list), non-Wikipedia external
          const isEntityUpload = sitemapType === 'entity' && !!site.entitySitemapUrl;
          const sanitizedHtmlContent = sanitizeContentForUpload(
            htmlContent,
            site.siteUrl,
            postsForInternalLinks,
            isEntityUpload && entityWikiForSanitize ? entityWikiForSanitize.url : undefined,
            rowExternalUrlsForSanitize,
            isEntityUpload && entityWikiForSanitize ? entityWikiForSanitize.label : undefined,
          );

          const preValidatedUrls = getBulkPreValidatedUrlsForSite(site.id);
          const { html: validatedHtml } = await validateAndStripInvalidLinksFromContent(
            sanitizedHtmlContent,
            undefined,
            site.siteUrl,
            (msg) => options.onProgress?.(rowIndex, 0, msg),
            undefined,
            preValidatedUrls ?? undefined
          );
          let contentForUpload = stripTrailingFaqSection(validatedHtml);

          // Content Opt parity: stitch backend FAQ Q/A into flo-faq table before first publish.
          {
            const earlyEntries = resolveFaqEntriesForVisibleTable(
              precomputedAcfSeoBundle?.faqEntries
            );
            const openRouterApiKeyEarly = (options.openRouterApiKey || loadApiKey() || '').trim();
            if (
              earlyEntries.length &&
              openRouterApiKeyEarly &&
              contentForUpload.trim() &&
              !contentForUpload.toLowerCase().includes(`class="${FLO_FAQ_CLASS}"`)
            ) {
              options.onProgress?.(rowIndex, 0, 'Appending FAQ table to post body...');
              const appendedEarly = await appendVisibleFaqTableWithIntro({
                sourceHtml: contentForUpload,
                entries: earlyEntries,
                apiKey: openRouterApiKeyEarly,
                focusKeyword: bulkPrimaryKw || keywordData.keyword,
                pageTitle: postTitle,
              });
              if (appendedEarly?.html) {
                contentForUpload = appendedEarly.html;
              }
            }
          }

          if (useGoogleMaps && entityForImage && !siteFeaturedImageId) {
            const mapsPayload = await fetchGoogleMapsImageForEntityWithFallback(
              entityForImage,
              options.googleMapsImageSerpLocation,
            );
            if (mapsPayload?.imageBase64?.trim()) {
              const extension = mapsPayload.mimeType === "image/jpeg" ? "jpg" : "png";
              const uploaded = await uploadDirectFeaturedMedia({
                site,
                imageBase64: mapsPayload.imageBase64,
                filename: sapMapsImageFileName(entityForImage, extension),
                title: enrichedRow.title || blueprintResult.title || entityForImage,
                keyword: bulkPrimaryKw || entityForImage,
              });
              siteFeaturedImageId = uploaded.mediaId;
              featuredImageLink = uploaded.url ?? featuredImageLink;
              if (options.sapMapsMediaBank) {
                setSapMapsMediaId(options.sapMapsMediaBank, site.id, entityForImage, siteFeaturedImageId);
              }
            }
          }
          let postResult: { success: boolean; postId?: number; link?: string } = { success: false };
          if (options.updateTargetPostId != null && options.updateTargetPostId > 0) {
            const updateResult = await updateWordPressPost(
              site.siteUrl,
              site.username,
              site.appPassword,
              options.updateTargetPostId,
              postTitle,
              contentForUpload,
              excerpt,
              wpPostStatus,
              sitemapType === 'entity' ? entityEndpoint : 'post',
              siteFeaturedImageId,
              undefined,
              undefined,
              slug,
              entityEndpoint,
            );
            postResult = {
              success: true,
              postId: updateResult.postId ?? options.updateTargetPostId,
              link: updateResult.link,
            };
          } else {
            postResult = await createWordPressPost(
              site.siteUrl,
              site.username,
              site.appPassword,
              postTitle,
              contentForUpload,
              excerpt,
              wpPostStatus,
              options.wordPressPosting.draftOnly
                ? undefined
                : formatWordPressDate(scheduledDate),
              siteFeaturedImageId,
              undefined,
              undefined,
              undefined,
              entityEndpoint,
              slug,
              authorId,
            );
          }

          if (postResult.success && postResult.postId) {
            // Update ACF fields after successful post creation (discover field names like wordpress-uploader)
            const entity = enrichedRow.entity && enrichedRow.entity.trim() && enrichedRow.entity.trim() !== 'N/A'
              ? enrichedRow.entity.trim()
              : undefined;
            let acfUpdatedList: string[] | undefined;
            const postTypeForAcf = sitemapType === 'entity' ? entityEndpoint : 'post';

            const postLink =
              contractDestination ||
              (typeof postResult.link === 'string' && postResult.link.trim()
                ? postResult.link.trim()
                : `${String(site.siteUrl).replace(/\/$/, '')}/?p=${postResult.postId}`);

            const optimizedMetaBootstrap = buildOptimizedMetaFromKeywordResearch(
              rankMeta,
              postTitle,
              excerpt,
              bulkPrimaryKw,
              postLink,
              site.siteUrl
            );

            /** Hoisted so research JSON + bulk ACF SEO apply share the same merged string. */
            let seoResearchJson = '';
            try {
              options.onProgress?.(rowIndex, 0, `Discovering ACF fields for post ${postResult.postId}...`);
              const acfResult = await getACFFieldsForPost(
                site,
                postResult.postId,
                postTypeForAcf,
                entityEndpoint
              );
              const existingAcfFields = acfResult.success && acfResult.fields ? acfResult.fields : {};
              const fieldsForMapping = await resolveAcfFieldsForMapping(
                site,
                existingAcfFields as Record<string, unknown>,
              );
              const openRouterApiKey = options.openRouterApiKey || loadApiKey();
              const fbMapping = fallbackFieldMapping(fieldsForMapping);
              const discoveredMapping = await discoverACFFieldMapping(
                fieldsForMapping,
                postTypeForAcf,
                openRouterApiKey || '',
                site.siteUrl
              );
              const fieldMapping = { ...fbMapping, ...discoveredMapping };
              const fieldNames = {
                dateModifier: fieldMapping.dateModifier || 'date_modifier',
                faq: fieldMapping.faq || 'faq',
                promptModifier: fieldMapping.promptModifier || 'prompt_modifier',
                origin: fieldMapping.origin || 'origin',
                keywordFocus: fieldMapping.keywordFocus || 'keyword_focus',
                seoResearch: fieldMapping.seoResearch || 'seo_research',
              };

              let faqForAcf = '';
              const semrushSeoExtras: Record<string, unknown> = {};
              if (semrushCitationForAcf) {
                semrushSeoExtras.semrush_primary_external_url = semrushCitationForAcf;
              }
              semrushSeoExtras.research_intent =
                intelligentMergeForAcf?.primaryIntent ?? keywordData.intent;
              {
                const ovAcf = safeTrimSemrushOverviewForAcf(semrushSnapshotForAcf?.keywordOverview);
                if (ovAcf !== undefined) {
                  semrushSeoExtras.semrush_keyword_overview = ovAcf;
                }
              }

              let visibleFaqEntries: FaqEntry[] | undefined;

              if (precomputedAcfSeoBundle) {
                seoResearchJson = patchPostLinkInSeoResearchJson(
                  precomputedAcfSeoBundle.seoResearchJson,
                  postLink,
                  site.siteUrl,
                  postTitle,
                  excerpt,
                  bulkPrimaryKw,
                  rankMeta
                );
                seoResearchJson = mergeSemrushFieldsIntoSeoResearchJson(
                  seoResearchJson,
                  semrushSeoExtras
                );
                faqForAcf = precomputedAcfSeoBundle.faqForAcf;
                visibleFaqEntries = resolveFaqEntriesForVisibleTable(
                  precomputedAcfSeoBundle.faqEntries
                );
              } else {
                const seoResearchObj: Record<string, unknown> = {
                  primary_keyword: bulkPrimaryKw || keywordData.keyword,
                  title: enrichedRow.title || blueprintResult.title,
                  generatedAt: new Date().toISOString(),
                  post_link: postLink,
                  seo_title: optimizedMetaBootstrap.rank_math_title,
                  meta_description: optimizedMetaBootstrap.rank_math_description,
                  focus_keyword: optimizedMetaBootstrap.rank_math_focus_keyword,
                  optimizedMeta: {
                    rank_math_title: optimizedMetaBootstrap.rank_math_title,
                    rank_math_description: optimizedMetaBootstrap.rank_math_description,
                    rank_math_focus_keyword: optimizedMetaBootstrap.rank_math_focus_keyword,
                    rank_math_canonical_url: optimizedMetaBootstrap.rank_math_canonical_url,
                    rank_math_robots: optimizedMetaBootstrap.rank_math_robots,
                  },
                  ...semrushSeoExtras,
                };
                if (semrushKeywordsContext?.trim()) {
                  try {
                    seoResearchObj.semrush_keywords = JSON.parse(semrushKeywordsContext);
                  } catch {
                    seoResearchObj.semrush_keywords_raw = semrushKeywordsContext.slice(0, 8000);
                  }
                }
                if (semrushScatterContext?.trim()) {
                  try {
                    seoResearchObj.semrush_scatter = JSON.parse(semrushScatterContext);
                  } catch {
                    seoResearchObj.semrush_scatter_raw = semrushScatterContext.slice(0, 8000);
                  }
                }

                if (enrichedRow.faq && enrichedRow.faq.trim()) {
                  const parsed = parseFaqEntries(enrichedRow.faq.trim());
                  if (parsed.length > 0) {
                    visibleFaqEntries = parsed;
                    const napLocs = napLocationsFromSite(site);
                    faqForAcf = buildFAQSchemaScriptFromEntries(
                      parsed,
                      bulkPrimaryKw,
                      entity,
                      site.siteUrl,
                      napLocs
                    );
                    seoResearchObj.faq_entries = parsed.map((e) => ({
                      question: e.question,
                      answer: e.answer.slice(0, 2000),
                    }));
                  }
                } else if (bulkPrimaryKw && markdownContent && openRouterApiKey?.trim()) {
                  const napLocs = napLocationsFromSite(site);
                  options.onProgress?.(
                    rowIndex,
                    0,
                    `Generating in-context FAQ for ACF...`
                  );
                  const briefForFaq = JSON.stringify(seoResearchObj).slice(0, 24000);
                  const entries = await generateBulkFaqEntriesInContext({
                    markdownContent,
                    postTitle,
                    pageMeta: excerpt,
                    primaryKeyword: bulkPrimaryKw,
                    postUrl: postLink,
                    seoResearchBrief: briefForFaq,
                    site,
                    apiKey: openRouterApiKey,
                    siteId: site.id,
                    pairCount: 4,
                  });
                  if (entries.length > 0) {
                    visibleFaqEntries = entries;
                    faqForAcf = buildFAQSchemaScriptFromEntries(
                      entries,
                      bulkPrimaryKw,
                      entity,
                      site.siteUrl,
                      napLocs
                    );
                    seoResearchObj.faq_entries = entries.map((e) => ({
                      question: e.question,
                      answer: e.answer.slice(0, 2000),
                    }));
                  }
                }

                visibleFaqEntries = resolveFaqEntriesForVisibleTable(visibleFaqEntries);

                if (faqForAcf) {
                  seoResearchObj.faq_schema_ld_json = faqForAcf;
                }

                seoResearchJson = mergeSeoResearchWithMeta(
                  JSON.stringify(seoResearchObj),
                  optimizedMetaBootstrap,
                  bulkPrimaryKw
                );
              }

              // Safety: append only if first publish still lacks flo-faq (e.g. no precomputed bundle).
              const bodyHasFloFaq = contentForUpload
                .toLowerCase()
                .includes(`class="${FLO_FAQ_CLASS}"`);
              if (
                !bodyHasFloFaq &&
                visibleFaqEntries?.length &&
                openRouterApiKey?.trim() &&
                contentForUpload.trim()
              ) {
                options.onProgress?.(rowIndex, 0, 'Appending FAQ table to post body...');
                const appended = await appendVisibleFaqTableWithIntro({
                  sourceHtml: contentForUpload,
                  entries: visibleFaqEntries,
                  apiKey: openRouterApiKey,
                  focusKeyword: bulkPrimaryKw || keywordData.keyword,
                  pageTitle: postTitle,
                });
                if (appended?.html) {
                  contentForUpload = appended.html;
                  await updateWordPressPost(
                    site.siteUrl,
                    site.username,
                    site.appPassword,
                    postResult.postId,
                    postTitle,
                    contentForUpload,
                    excerpt,
                    undefined,
                    postTypeForAcf,
                    siteFeaturedImageId,
                    undefined,
                    undefined,
                    slug,
                    entityEndpoint
                  );
                }
              }

              const acfMetaFields: Record<string, string> = {};
              acfMetaFields[fieldNames.dateModifier] = new Date().toISOString().split('T')[0];
              if (enrichedRow.prompt_modifier && enrichedRow.prompt_modifier.trim()) {
                acfMetaFields[fieldNames.promptModifier] = enrichedRow.prompt_modifier.trim();
              }
              if (enrichedRow.service_area_fields && enrichedRow.service_area_fields.trim()) {
                acfMetaFields['service_area_fields'] = enrichedRow.service_area_fields.trim();
              }
              if (acfOriginAppliesForSitemapType(sitemapType)) {
                const titleForAcfOrigin = (enrichedRow.title ?? postTitle ?? '').trim();
                const originFromTitle = extractOriginFromSapTitle(titleForAcfOrigin);
                if (enrichedRow.origin && enrichedRow.origin.trim() && enrichedRow.origin.trim() !== 'N/A') {
                  acfMetaFields[fieldNames.origin] = enrichedRow.origin.trim();
                } else if (originFromTitle) {
                  acfMetaFields[fieldNames.origin] = originFromTitle;
                } else if (entity) {
                  acfMetaFields[fieldNames.origin] = entity;
                }
              }

              const optimizedMetaForSync =
                parseOptimizedMetaFromSeoResearchJson(seoResearchJson) ?? optimizedMetaBootstrap;

              const acfWritePayload: Record<string, string> = { ...acfMetaFields };
              if (bulkPrimaryKw) {
                acfWritePayload[fieldNames.keywordFocus] = bulkPrimaryKw;
              }
              if (seoResearchJson) {
                acfWritePayload[fieldNames.seoResearch] = seoResearchJson;
              }
              if (faqForAcf) {
                acfWritePayload[fieldNames.faq] = faqForAcf;
              }
              const mappedMetaFields = buildAcfPayload(
                fieldMapping,
                optimizedMetaForSync,
                bulkPrimaryKw,
                existingAcfFields as Record<string, unknown>,
                seoResearchJson,
                { includeSeoResearchInPayload: false },
              );
              for (const [key, value] of Object.entries(mappedMetaFields)) {
                if (value?.trim() && acfWritePayload[key] === undefined) {
                  acfWritePayload[key] = value;
                }
              }

              let seoResearchJsonForDownload = seoResearchJson;

              options.onProgress?.(
                rowIndex,
                0,
                `SEO meta + ACF (single batch) for post ${postResult.postId}...`,
              );

              const rankMathPromise = updateWordPressPostMeta(
                site.siteUrl,
                site.username,
                site.appPassword,
                postResult.postId,
                postTypeForAcf,
                entityEndpoint,
                {
                  rank_math_title: optimizedMetaForSync.rank_math_title,
                  rank_math_description: optimizedMetaForSync.rank_math_description,
                  rank_math_focus_keyword: optimizedMetaForSync.rank_math_focus_keyword,
                },
              ).catch((rmErr) => {
                console.warn('[Bulk Upload] SEO post meta sync failed (non-fatal):', rmErr);
              });

              const acfPromise =
                Object.keys(acfWritePayload).length > 0
                  ? updateACFFields(
                      site.siteUrl,
                      site.username,
                      site.appPassword,
                      postResult.postId,
                      acfWritePayload,
                      postTypeForAcf,
                      entityEndpoint,
                    ).then((acfUpdateResult) => {
                      if (acfUpdateResult.success) {
                        acfUpdatedList = acfUpdateResult.updated;
                        console.log(
                          `[Bulk Upload] ACF batch OK [${acfUpdateResult.updated.join(', ')}] post ${postResult.postId}`,
                        );
                        options.onProgress?.(
                          rowIndex,
                          0,
                          `ACF saved: ${acfUpdateResult.updated.join(', ')}`,
                        );
                      } else {
                        const errMsg =
                          acfUpdateResult.error ||
                          (acfUpdateResult.failed?.length
                            ? acfUpdateResult.failed.map((f) => `${f.field}: ${f.error}`).join('; ')
                            : 'Unknown error');
                        console.warn(
                          `[Bulk Upload] ACF batch failed for post ${postResult.postId}:`,
                          acfUpdateResult,
                        );
                        options.onProgress?.(rowIndex, 0, `ACF batch failed: ${errMsg}`);
                      }
                    })
                  : Promise.resolve();

              await Promise.all([rankMathPromise, acfPromise]);

              if (siteIndex === 0) {
                const researchSlug = (enrichedRow.title || blueprintResult.title || 'post')
                  .replace(/[^a-zA-Z0-9]+/g, '-')
                  .toLowerCase();
                const researchFileName = `seo-research-${researchSlug}-${timestamp}.json`;
                const researchFileId = BulkFileManager.createFileId(rowIndex, 'seo-research', timestamp);
                const seoResearchFile: BulkGeneratedFile = {
                  id: researchFileId,
                  rowIndex,
                  fileName: researchFileName,
                  content: JSON.stringify(JSON.parse(seoResearchJsonForDownload), null, 2),
                  mimeType: 'application/json',
                  status: 'completed',
                  timestamp,
                  rowData: row,
                };
                fileManager.addFile(seoResearchFile);
                generatedFiles.push(seoResearchFile);
              }
            } catch (acfError) {
              const errMsg = acfError instanceof Error ? acfError.message : String(acfError);
              console.warn(`[Bulk Upload] Error updating ACF fields for post ${postResult.postId}:`, acfError);
              options.onProgress?.(rowIndex, 0, `ACF update failed: ${errMsg}`);
            }

            // Create wordpress-post JSON file for this site
            const siteNameSlug = site.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
            const wordPressPostFileName = `wordpress-post-${siteNameSlug}-${enrichedRow.title.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${timestamp}.json`;
            const wordPressPostFileId = BulkFileManager.createFileId(rowIndex, `wordpress-post-${siteIndex}`, timestamp);

            const wordPressPostFile: BulkGeneratedFile = {
              id: wordPressPostFileId,
              rowIndex,
              fileName: wordPressPostFileName,
              content: JSON.stringify({
                postId: postResult.postId,
                title: postTitle,
                link: postResult.link,
                status: postResult.status,
                scheduledDate: scheduledDate.toISOString(),
                date_gmt: formatWordPressDate(scheduledDate),
                publishDateSource: bulkPublishDateSource,
                endpoint: entityEndpoint,
                sitemapType: sitemapType,
                siteName: site.name,
                siteUrl: site.siteUrl,
              }, null, 2),
              mimeType: 'application/json',
              status: 'completed',
              timestamp,
              rowData: row,
            };

            fileManager.addFile(wordPressPostFile);
            generatedFiles.push(wordPressPostFile);

            if (siteIndex === 0) {
              const pageUrl =
                (typeof postResult.link === "string" && postResult.link.trim()) ||
                `${String(site.siteUrl).replace(/\/$/, "")}/?p=${postResult.postId}`;
              const wordpressDoc = {
                success: true,
                postId: postResult.postId,
                link: postResult.link ?? null,
                pageUrl,
                title: postTitle,
                wordpressSite: site.siteUrl,
                wordpressSiteId: site.id,
                wordpressSiteName: site.name,
                uploadedAt: new Date().toISOString(),
                error: null,
                featuredMediaId: siteFeaturedImageId ?? null,
                featuredImageLink: featuredImageLink ?? null,
              };
              const payloadDoc = {
                pageUrl,
                postId: postResult.postId,
                postTitle,
                postExcerpt: excerpt,
                endpoint: entityEndpoint,
                sitemapType,
                featuredMediaId: siteFeaturedImageId ?? null,
                featuredImageLink: featuredImageLink ?? null,
              };
              for (const proof of wpUploadHarnessGeneratedFiles(
                pageUrl,
                JSON.stringify(payloadDoc, null, 2),
                JSON.stringify(wordpressDoc, null, 2),
              )) {
                const proofFile: BulkGeneratedFile = {
                  id: BulkFileManager.createFileId(rowIndex, proof.name, timestamp),
                  rowIndex,
                  fileName: proof.name,
                  content: proof.content,
                  mimeType: proof.mimeType,
                  status: "completed",
                  timestamp,
                  rowData: row,
                };
                fileManager.addFile(proofFile);
                generatedFiles.push(proofFile);
              }
              const bodyTitles = extractBodyHarnessTitlesFromRowFiles(
                generatedFiles.map((file) => ({
                  name: file.fileName,
                  fileName: file.fileName,
                  content: file.content,
                })),
              );
              const pipelineTitles = rowUsesGoogleImageFeatured(enrichedRow, options.featuredImageType)
                ? buildGoogleImageEntitySapPipelineTitles(bodyTitles)
                : buildContentOptimizePipelineTitles(bodyTitles);
              const wpSectionIndex = pipelineTitles.indexOf("WordPress upload");
              if (wpSectionIndex >= 0) {
                options.onHarnessSection?.(
                  buildContentOptimizeHarnessPayload(
                    rowIndex,
                    wpSectionIndex,
                    "done",
                    undefined,
                    pipelineTitles,
                  ),
                );
              }
            }

            options.onProgress?.(
              rowIndex,
              0,
              `WordPress post created on ${site.name}: ${postResult.link || postResult.postId} (ID ${postResult.postId}, scheduled for ${formatWordPressDate(scheduledDate)}${
                bulkPublishDateSource === 'csv' ? ', from CSV publish_date_gmt' : ''
              })`,
            );
            options.onAppendHistory?.({
              ts: Date.now(),
              entityOrTitle: enrichedRow.entity?.trim() || enrichedRow.title || undefined,
              site: site.name,
              step: 'upload',
              message: `Post created on ${site.name}: ID ${postResult.postId}${acfUpdatedList?.length ? `, ACF updated: ${acfUpdatedList.join(', ')}` : ''}`,
              outcome: 'ok',
              postId: postResult.postId,
              permalink: postResult.link,
              acfUpdated: acfUpdatedList,
              mode: sitemapType,
            });
          }
        } catch (uploadError) {
          const errMsg =
            uploadError instanceof Error ? uploadError.message : String(uploadError);
          console.error(`[WordPress] Upload failed for ${site.name}:`, uploadError);
          options.onProgress?.(rowIndex, 0, `WordPress upload failed: ${errMsg}`);
          options.onError?.(
            rowIndex,
            uploadError instanceof Error ? uploadError : new Error(errMsg),
          );
          if (siteIndex === 0) {
            const failEndpoint =
              sitemapType === "entity" && site.entitySitemapUrl
                ? extractEndpointFromEntitySitemapUrl(site.entitySitemapUrl)
                : "posts";
            const pageUrl =
              uploadPageUrl ||
              `${String(site.siteUrl).replace(/\/$/, "")}/?p=pending`;
            const wordpressDoc = {
              success: false,
              postId: null,
              link: null,
              pageUrl,
              title: bulkResolvedPostTitle,
              wordpressSite: site.siteUrl,
              wordpressSiteId: site.id,
              wordpressSiteName: site.name,
              uploadedAt: new Date().toISOString(),
              error: errMsg,
              featuredMediaId: featuredImageId ?? null,
              featuredImageLink: featuredImageLink ?? null,
            };
            const payloadDoc = {
              pageUrl,
              postId: null,
              postTitle: bulkResolvedPostTitle,
              postExcerpt: excerpt,
              endpoint: failEndpoint,
              sitemapType,
              featuredMediaId: featuredImageId ?? null,
              featuredImageLink: featuredImageLink ?? null,
              error: errMsg,
            };
            for (const proof of wpUploadHarnessGeneratedFiles(
              pageUrl,
              JSON.stringify(payloadDoc, null, 2),
              JSON.stringify(wordpressDoc, null, 2),
            )) {
              const proofFile: BulkGeneratedFile = {
                id: BulkFileManager.createFileId(rowIndex, proof.name, timestamp),
                rowIndex,
                fileName: proof.name,
                content: proof.content,
                mimeType: proof.mimeType,
                status: "completed",
                timestamp,
                rowData: row,
              };
              fileManager.addFile(proofFile);
              generatedFiles.push(proofFile);
            }
            const bodyTitles = extractBodyHarnessTitlesFromRowFiles(
              generatedFiles.map((file) => ({
                name: file.fileName,
                fileName: file.fileName,
                content: file.content,
              })),
            );
            const pipelineTitles = rowUsesGoogleImageFeatured(enrichedRow, options.featuredImageType)
              ? buildGoogleImageEntitySapPipelineTitles(bodyTitles)
              : buildContentOptimizePipelineTitles(bodyTitles);
            const wpSectionIndex = pipelineTitles.indexOf("WordPress upload");
            if (wpSectionIndex >= 0) {
              options.onHarnessSection?.(
                buildContentOptimizeHarnessPayload(
                  rowIndex,
                  wpSectionIndex,
                  "done",
                  undefined,
                  pipelineTitles,
                ),
              );
            }
          }
        }
      }
    }
    return generatedFiles;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error(String(error));
  }
}
