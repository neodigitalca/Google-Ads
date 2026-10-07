import { buildFocusedArticlePurpose } from "@/lib/content-generation/article-length-policy";
import { injectImportedLinksIntoBlueprintAgents, injectImportedLinksIntoChecklist } from "./blog-import-draft-links";
import type { ImportedDraftLink } from "./blog-import-draft-links";
import { injectEntityWikipediaIntoBlueprintAgents, injectEntityWikipediaIntoChecklist } from "./entity-wikipedia-prompt";
import {
  injectModifierExternalLinksIntoBlueprintAgents,
  injectModifierExternalLinksIntoChecklist,
  injectLlmAuditAuthorityLinksIntoBlueprintAgents,
  injectLlmAuditAuthorityLinksIntoChecklist,
} from "./modifier-external-links";
import type { ModifierExternalLink } from "./modifier-external-links";
import {
  enforceForbiddenWordsOnBlueprint,
  formatBlueprintFileContent,
  formatChecklistFileContent,
  GLOBAL_FORBIDDEN_WORDS_PROMPT_BLOCK,
  prepareChecklistForPipeline,
} from "@/lib/content-word-blocklist";
import { hasCsvFilledMeta } from "./prefilled-bulk-row-contract";
import { generateChecklistFromSelections, generateBlueprintFromTemplate } from "../blog-template-builder";
import type { BlogTemplateContext } from "../blog-template-builder";
import type { ImageChecklistItem } from "../image-checklist-builder";
import { generateImageChecklist } from "./bulk-image-generator";
import type { KeywordData } from "../keyword-types";
import { BulkFileManager, type BulkGeneratedFile } from "../bulk-file-manager";
import { rowUsesGoogleImageFeatured } from "../overview/overview-content-optimize-pipeline";
import { sanitizeWordPressSlugSegment } from "../rank-math-redirect-csv";
import { bulkPostsToExtraTextLinkRows, emitEntitySapPipelineHarnessDone } from "@/lib/bulk/bulk-harness-progress";
import {
  buildPreBlogSeoResearchSkeleton,
  mergeBlueprintIntoPreBlogSkeleton,
} from "@/lib/content-generation/bulk-acf-seo-bundle";
import { generateMetaDescription } from "@/lib/content-generation/content-generator";
import { resolveBulkWordPressPostTitle } from "@/lib/bulk/bulk-post-title-agent";
import { loadApiKey } from "../api";
import { mergeSeoBriefIntoBulkSkeleton } from "@/lib/llm-audit/fetch-merged-seo-content-brief";
import type { SeoContentBriefV1 } from "@/lib/overview-seo-content-brief";
import { acfOriginAppliesForSitemapType } from "@/lib/acf-origin-applies";
import type { BulkProcessingOptions } from "./bulk-auto-generate-types";
import type { CSVRow } from "./bulk-csv-parser";
import { resolveBulkPrimaryKeyword } from "./bulk-primary-keyword";
import { keepBlogPlayLinkTargets, inventoryRowsToWordPressLinkables } from "./bulk-generation-wp-inventory";
import type { LinkTargetsPlan } from "./bulk-generation-wp-inventory";
import { getBulkGenerationWpInventoryIfReady } from "./bulk-generation-inventory-cache-store";
import { runContentLinkTargetsHarness } from "../overview/overview-content-link-targets-harness-run";
import { OptimizationFileManager } from "../optimization-file-manager";
import { resolveRankMathFromKeywordResearch } from "@/lib/bulk/bulk-keyword-research-artifacts";
import { bulkRowSerpLocationName } from "./bulk-row-research-enrichment";
import type { ExternalLinkPair } from "../content-generation/external-link-placeholders";
import type { LlmAuditAuthorityLinkLike } from "./modifier-external-links";

export type BulkRowChecklistBlueprintPhaseResult = {
  enrichedRow: CSVRow;
  checklistResult: Awaited<ReturnType<typeof generateChecklistFromSelections>>;
  checklist: string[];
  linkTargetsPlan: LinkTargetsPlan | undefined;
  flowPurposeStr: string;
  outlineTextForImage: string;
  entityForImage: string | undefined;
  useGoogleMaps: boolean;
  useAiImagePath: boolean;
  preBlogSeoSkeleton: ReturnType<typeof buildPreBlogSeoResearchSkeleton>;
  blueprintResult: Awaited<ReturnType<typeof generateBlueprintFromTemplate>> & { h2Outline?: string[] };
  precomputedImageChecklist: ImageChecklistItem[];
  precomputedMetaDescription: string | undefined;
  flowTitleForBlueprint: string;
  flowPurposeResolved: string;
  bulkPrimaryKwResolved: string;
  bulkResolvedPostTitle: string;
};

export async function runBulkRowChecklistAndBlueprintPhase(input: {
  rowIndex: number;
  row: CSVRow;
  enrichedRow: CSVRow;
  keywordData: KeywordData;
  options: BulkProcessingOptions;
  fileManager: BulkFileManager;
  timestamp: number;
  generatedFiles: BulkGeneratedFile[];
  connectedSite?: { name: string; siteUrl: string; id?: string };
  postsForInternalLinks: Array<{ id: number; slug: string; title: string; excerpt: string; link: string; date_gmt: string }>;
  paaRawResponse: unknown;
  selectedKeywords: string[];
  selectedH2Sections: string[];
  selectedPeopleAlsoAsk: string[];
  selectedResearchLinks: string[];
  importedDraftLinks: ImportedDraftLink[];
  modifierExternalLinks: ModifierExternalLink[];
  importedH2Outline: string[];
  rowExplicitExternalPairs: ExternalLinkPair[];
  prefilledRowContract: string;
  pipelineResearchModel: string;
  pipelineBlogModel: string;
  pipelineSiteId: string | undefined;
  entityForLocalTemplate: string | undefined;
  entityWikiUrl: string | undefined;
  entityWikiTitle: string | undefined;
  llmAuditSummaryPrompt: string;
  dfsArticleAuditBlock: string;
  firstPartyAuthorityBlock: string;
  llmAuditAuthorityLinks: LlmAuditAuthorityLinkLike[];
  serpLlmBriefJson: string;
  serpLlmBrief: SeoContentBriefV1;
  serpStoredFile: string | null;
  llmOkCount: number;
  destinationPageUrl: string;
  serpSite: import("@/components/integrations/types").WordPressSite | undefined;
  semrushKeywordsContext?: string;
  semrushScatterContext?: string;
}): Promise<BulkRowChecklistBlueprintPhaseResult> {
  let {
    rowIndex,
    row,
    enrichedRow,
    keywordData,
    options,
    fileManager,
    timestamp,
    generatedFiles,
    connectedSite,
    postsForInternalLinks,
    paaRawResponse,
    selectedKeywords,
    selectedH2Sections,
    selectedPeopleAlsoAsk,
    selectedResearchLinks,
    importedDraftLinks,
    modifierExternalLinks,
    importedH2Outline,
    rowExplicitExternalPairs,
    prefilledRowContract,
    pipelineResearchModel,
    pipelineBlogModel,
    pipelineSiteId,
    entityForLocalTemplate,
    entityWikiUrl,
    entityWikiTitle,
    llmAuditSummaryPrompt,
    dfsArticleAuditBlock,
    firstPartyAuthorityBlock,
    llmAuditAuthorityLinks,
    serpLlmBriefJson,
    serpLlmBrief,
    serpStoredFile,
    llmOkCount,
    destinationPageUrl,
    serpSite,
    semrushKeywordsContext,
    semrushScatterContext,
  } = input;

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
  return {
    enrichedRow,
    checklistResult,
    checklist,
    linkTargetsPlan,
    flowPurposeStr,
    outlineTextForImage,
    entityForImage,
    useGoogleMaps,
    useAiImagePath,
    preBlogSeoSkeleton,
    blueprintResult,
    precomputedImageChecklist,
    precomputedMetaDescription,
    flowTitleForBlueprint,
    flowPurposeResolved,
    bulkPrimaryKwResolved,
    bulkResolvedPostTitle,
  };
}
