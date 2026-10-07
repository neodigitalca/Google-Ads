import { useState, useCallback, useRef, useEffect } from 'react';
import { notify } from "@/lib/app-notifications";
import { NOTIFY_ALL_BLOG_IDEAS_ARE_ALREADY_SELECTED_PLEA, NOTIFY_FAILED_TO_GENERATE_CHECKLIST_PLEASE_TRY_, NOTIFY_PLEASE_DESELECT_AT_LEAST_ONE_BLOG_IDEA_T, NOTIFY_PLEASE_ENSURE_API_KEYS_ARE_SET } from "@/lib/notify-messages";
import { resolveOpenRouterApiKeyForHarness } from '@/lib/openrouter-api-key-resolve';
import type { CSVRow } from '@/lib/bulk-auto-generate';
import { parseTitleTemplate } from '@/lib/title-template-parser';
import type { Message } from '@/lib/api';
import { revokeBulkSitemapInventoryLinks } from '@/lib/bulk/bulk-sitemap-inventory-session';
import type { PromptBulkSitemapInventoryLink } from '@/lib/bulk/prompt-bulk-sitemap-inventory';
import { getStoredSites, type WordPressSite } from '@/components/IntegrationsTab';
import type { ConnectedSiteSummary } from '@/components/integrations/types';
import { getResearchModel } from '@/lib/optimization-settings-storage';
import type { KeywordAIAnalysis } from '@/lib/keyword-types';
import { revokePromptBulkSiteKwHostedLink, type PromptBulkSiteKwHostedLink } from '@/lib/bulk/prompt-bulk-site-kw-scrape';
import { mergePromptBulkIdeaSlots } from '@/lib/bulk/merge-prompt-bulk-idea-slots';
import { generateSimplePromptIdeas } from '@/lib/bulk/prompt-bulk-ideas-simple';
import { fillBlogRowKeywordFocusFromOpenRouter } from '@/lib/bulk/prompt-bulk-keyword-focus-agent';
import { fillBlogRowMetaFromOpenRouter } from '@/lib/local-analysis/entity-sap-meta-agent';
import { fillBlogRowSlugFromOpenRouter } from '@/lib/local-analysis/blog-slug-agent';
import type { BulkSiteSitemapConfig } from '@/components/keyword-research/bulk/BulkGeneratorSitemapMenu';

export interface UsePromptBulkGenerateProps {
  apiKey?: string;
  openRouterApiKey?: string;
  selectedModel?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  flowPurpose?: string;
  // Blog generation settings - count is required; use the amount the user picked (no default/fallback).
  numberOfBlogs: number;
  entityMode?: 'auto' | 'manual' | 'blank';
  entityValue?: string;
  keywordMode?: 'same' | 'per-blog' | 'gsc-keywords';
  keywordValue?: string;
  gscExactKeywords?: string[]; // Exact GSC keywords to use
  optionalPrompt?: string;
  titleTemplate?: string; // Title template with variables like [Entity], [Keyword]
  entityList?: string; // Comma or newline-separated list of entity values
  keywordList?: string; // Comma or newline-separated list of keyword values
  locationList?: string; // Comma or newline-separated list of location values
  numberList?: string; // Comma or newline-separated list of number values
  featuredImagePerBlog?: boolean;
  // Connected WordPress site (for target topic)
  connectedSite?: ConnectedSiteSummary;
  siteConfigs?: Record<string, BulkSiteSitemapConfig>;
  selectedWordPressSites?: Set<string>;
  // Progress callback for sub-step tracking
  onProgress?: (step: string, progress: number) => void;
  // Keyword analysis results from Content Optimizer module
  keywordAnalysisResults?: Map<string, KeywordAIAnalysis>;
}

export function usePromptBulkGenerate({
  apiKey,
  openRouterApiKey,
  selectedModel = getResearchModel(),
  temperature = 1.0,
  maxTokens = 4000,
  topP = 0.9,
  flowPurpose,
  numberOfBlogs,
  entityMode = 'blank',
  entityValue = '',
  keywordMode = 'per-blog',
  keywordValue = '',
  optionalPrompt = '',
  titleTemplate = '',
  entityList = '',
  keywordList = '',
  locationList = '',
  numberList = '',
  featuredImagePerBlog = true,
  connectedSite,
  siteConfigs,
  selectedWordPressSites,
  gscExactKeywords = [],
  onProgress,
  keywordAnalysisResults,
}: UsePromptBulkGenerateProps) {
  const [userInput, setUserInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [hasGeneratedChecklist, setHasGeneratedChecklist] = useState(false);
  const [generatedRows, setGeneratedRows] = useState<CSVRow[]>([]);
  const [wordPressPostsMetadata, setWordPressPostsMetadata] = useState<Array<{ id: number; slug: string; title: string; link: string }>>([]);
  const [sitemapInventoryLinks, setSitemapInventoryLinks] = useState<PromptBulkSitemapInventoryLink[]>([]);
  const [siteKwHostedLink, setSiteKwHostedLink] = useState<PromptBulkSiteKwHostedLink | null>(null);
  /** Total URLs sent to AI across Posts + Pages + SAP buckets (null = not yet loaded). */
  const [lastInventorySentToAiCount, setLastInventorySentToAiCount] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sitemapLinksRef = useRef<PromptBulkSitemapInventoryLink[]>([]);
  const siteKwLinkRef = useRef<PromptBulkSiteKwHostedLink | null>(null);

  useEffect(() => {
    return () => {
      revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
      revokePromptBulkSiteKwHostedLink(siteKwLinkRef.current);
    };
  }, []);

  /**
   * Generate checklist from settings (no user prompt required)
   * @param keepIndices Optional array of indices to keep from existing generatedRows
   */
  const handleGenerateChecklist = useCallback(async (keepIndices?: number[]): Promise<CSVRow[] | undefined> => {
    let effectiveOpenRouterKey = "";
    try {
      effectiveOpenRouterKey = (await resolveOpenRouterApiKeyForHarness()).trim();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : NOTIFY_PLEASE_ENSURE_API_KEYS_ARE_SET);
      return undefined;
    }

    setIsGeneratingChecklist(true);
    setLastInventorySentToAiCount(null);

    const allSlotKeywords = generatedRows
      .slice(0, numberOfBlogs)
      .map((r) => r.keyword?.trim() ?? "");
    const allSlotModifiers = generatedRows
      .slice(0, numberOfBlogs)
      .map((r) => r.modifier?.trim() ?? "");

    // Calculate how many new blogs to generate
    const keptCount = keepIndices ? keepIndices.length : 0;
    const blogsToGenerate = numberOfBlogs - keptCount;

    const slotKeywordsForGeneration =
      keepIndices && keepIndices.length > 0
        ? allSlotKeywords.filter((_, i) => !keepIndices.includes(i))
        : allSlotKeywords.slice(0, blogsToGenerate);

    const slotModifiersForGeneration =
      keepIndices && keepIndices.length > 0
        ? allSlotModifiers.filter((_, i) => !keepIndices.includes(i))
        : allSlotModifiers.slice(0, blogsToGenerate);

    if (blogsToGenerate <= 0) {
      notify.error(NOTIFY_ALL_BLOG_IDEAS_ARE_ALREADY_SELECTED_PLEA);
      setIsGeneratingChecklist(false);
      return undefined;
    }
    
    const topicLine = [flowPurpose?.trim(), optionalPrompt?.trim()].filter(Boolean).join(". ");
    const userMessage = topicLine
      ? `Generate ${blogsToGenerate} blog post ideas for this topic: ${topicLine}`
      : `Generate ${blogsToGenerate} blog post ideas`;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      onProgress?.("Generating blog ideas…", 30);

      let matchedWpSite: WordPressSite | null = null;
      if (connectedSite) {
        const sites = getStoredSites();
        const normalize = (url: string) =>
          url.trim().toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
        matchedWpSite =
          sites.find((s) => normalize(s.siteUrl) === normalize(connectedSite.siteUrl)) ?? null;
      }

      const ideaModel = getResearchModel(matchedWpSite?.id);
      onProgress?.("Writing titles…", 60);

      let cappedParsedRows = await generateSimplePromptIdeas({
        apiKey: effectiveOpenRouterKey,
        model: ideaModel,
        count: blogsToGenerate,
        topic: flowPurpose,
        modifier: optionalPrompt,
        slotKeywords: slotKeywordsForGeneration,
        slotModifiers: slotModifiersForGeneration,
        temperature,
        maxTokens: Math.min(maxTokens || 4000, 8192),
      });

      if (featuredImagePerBlog) {
        cappedParsedRows = cappedParsedRows.map((row) => ({
          ...row,
          featuredImage: row.featuredImage ?? "y",
        }));
      }

      setLastInventorySentToAiCount(null);

      mergePromptBulkIdeaSlots({
        parsedRows: cappedParsedRows,
        generatedRows,
        slotKeywords: slotKeywordsForGeneration,
        slotModifiers: slotModifiersForGeneration,
        keepIndices,
      });

      // Helper function to parse list strings (split by newlines or commas)
      const parseListString = (list: string): string[] => {
        if (!list || !list.trim()) return [];
        return list
          .split(/[\n,]/)
          .map(item => item.trim())
          .filter(item => item.length > 0);
      };

      if (entityMode === "manual") {
        const entitySource = entityList?.trim() ? entityList : entityValue;
        if (entitySource?.trim()) {
          const entityValues = parseListString(entitySource);
          cappedParsedRows.forEach((row, index) => {
            const entityIndex = Math.min(index, entityValues.length - 1);
            row.entity = entityValues[entityIndex] || "";
          });
        }
      }

      if (titleTemplate && titleTemplate.trim()) {
        const entityValues = parseListString(entityList || '');
        const keywordValues = parseListString(keywordList || '');
        const locationValues = parseListString(locationList || '');
        const numberValues = parseListString(numberList || '');
        
        cappedParsedRows.forEach((row, index) => {
          const getListValue = (list: string[], fallback: string): string => {
            if (list.length > 0) {
              return list[Math.min(index, list.length - 1)] || fallback;
            }
            return fallback;
          };
          
          const variables: Record<string, string> = {
            Keyword: getListValue(keywordValues, row.keyword || ''),
            Entity: getListValue(entityValues, row.entity || ''),
            Location: getListValue(locationValues, ''),
            Number: getListValue(numberValues, String(index + 1)),
          };
          
          // FORCE template application - override any AI-generated title
          const templateTitle = parseTitleTemplate(titleTemplate, variables);
          if (templateTitle && templateTitle.trim()) {
            row.title = templateTitle.trim();
          }
          // Sync entity to row when template provided an Entity (so Origin ACF gets set from entity)
          if (variables.Entity && variables.Entity.trim() && variables.Entity.trim() !== 'N/A') {
            row.entity = variables.Entity.trim();
          }
        });
      }

      const lockedSlotKeywords = cappedParsedRows.map(
        (_, i) => Boolean(slotKeywordsForGeneration[i]?.trim()),
      );

      onProgress?.("Distilling focus keywords…", 78);
      cappedParsedRows = await fillBlogRowKeywordFocusFromOpenRouter(cappedParsedRows, {
        apiKey: effectiveOpenRouterKey,
        siteId: matchedWpSite?.id,
        siteName: (connectedSite?.name ?? matchedWpSite?.name ?? "").trim(),
        topic: flowPurpose?.trim() || topicLine,
        lockedSlotKeywords,
        strict: true,
        onProgress: (done, total) => {
          if (total > 0) {
            onProgress?.(`Focus keywords ${done}/${total}…`, 78 + Math.round((done / total) * 5));
          }
        },
      });

      onProgress?.("Writing meta descriptions…", 85);
      const rowsForMeta = cappedParsedRows.map((row) => {
        const { meta_description: _drop, ...rest } = row;
        return rest;
      });
      cappedParsedRows = await fillBlogRowMetaFromOpenRouter(rowsForMeta, {
        apiKey: effectiveOpenRouterKey,
        model: ideaModel,
        siteId: matchedWpSite?.id,
        siteName: (connectedSite?.name ?? matchedWpSite?.name ?? "").trim(),
        strict: true,
        onProgress: (done, total) => {
          if (total > 0) {
            onProgress?.(`Meta descriptions ${done}/${total}…`, 82 + Math.round((done / total) * 6));
          }
        },
      });
      const missingMeta = cappedParsedRows.find((r) => !(r.meta_description ?? "").trim());
      if (missingMeta) {
        throw new Error("Meta description agent did not return a description for every idea row.");
      }

      onProgress?.("Writing URL slugs…", 90);
      cappedParsedRows = await fillBlogRowSlugFromOpenRouter(cappedParsedRows, {
        apiKey: effectiveOpenRouterKey,
        model: ideaModel,
        siteId: matchedWpSite?.id,
        onProgress: (done, total) => {
          if (total > 0) {
            onProgress?.(`URL slugs ${done}/${total}…`, 90 + Math.round((done / total) * 8));
          }
        },
      });
      const missingSlug = cappedParsedRows.find((r) => !(r.target_slug ?? "").trim());
      if (missingSlug) {
        throw new Error("URL slug agent did not return a slug for every idea row.");
      }

      // Determine final rows (merged or new)
      let finalRows: CSVRow[];
      if (keepIndices && keepIndices.length > 0) {
        const keptRows = keepIndices.map(idx => generatedRows[idx]).filter(Boolean);
        finalRows = [...keptRows, ...cappedParsedRows].slice(0, numberOfBlogs);
      } else {
        finalRows = cappedParsedRows;
      }

      setGeneratedRows(finalRows);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: finalRows
            .map((r, i) => `${i + 1}. ${r.title}\nMeta: ${r.meta_description ?? ""}`)
            .join("\n\n"),
        },
      ]);

      onProgress?.("Done", 100);
      setHasGeneratedChecklist(true);
      return finalRows;
    } catch (error) {
      console.error('Checklist generation error:', error);
      onProgress?.('Generation failed', 0);
      const msg = error instanceof Error ? error.message : NOTIFY_FAILED_TO_GENERATE_CHECKLIST_PLEASE_TRY_;
      notify.error(msg);
      setChatMessages(prev => prev.slice(0, -1));
      return undefined;
    } finally {
      setIsGeneratingChecklist(false);
    }
  }, [
    openRouterApiKey,
    temperature,
    maxTokens,
    topP,
    flowPurpose,
    numberOfBlogs,
    entityMode,
    entityValue,
    keywordMode,
    keywordValue,
    optionalPrompt,
    titleTemplate,
    entityList,
    keywordList,
    locationList,
    numberList,
    featuredImagePerBlog,
    connectedSite,
    gscExactKeywords,
    generatedRows,
    onProgress,
    keywordAnalysisResults,
  ]);

  /**
   * Reset the prompt generation state
   */
  const resetPromptGeneration = useCallback(() => {
    setUserInput('');
    setChatMessages([]);
    setHasGeneratedChecklist(false);
    setGeneratedRows([]);
    setWordPressPostsMetadata([]);
    revokeBulkSitemapInventoryLinks(sitemapLinksRef.current);
    sitemapLinksRef.current = [];
    setSitemapInventoryLinks([]);
    revokePromptBulkSiteKwHostedLink(siteKwLinkRef.current);
    siteKwLinkRef.current = null;
    setSiteKwHostedLink(null);
    setLastInventorySentToAiCount(null);
  }, []);

  /**
   * Modify the checklist (regenerate with modifications)
   */
  const handleModifyChecklist = useCallback(() => {
    setHasGeneratedChecklist(false);
    setGeneratedRows([]);
    // Keep chat messages for context
  }, []);

  /**
   * Regenerate unselected blog ideas, keeping selected ones
   * Returns the new indices of the kept items (they will be at the beginning of the array)
   */
  const handleRegenerateUnselected = useCallback(async (selectedIndices: Set<number>): Promise<Set<number>> => {
    if (selectedIndices.size >= generatedRows.length) {
      notify.error(NOTIFY_PLEASE_DESELECT_AT_LEAST_ONE_BLOG_IDEA_T);
      return new Set();
    }

    // Convert Set to sorted array for consistent ordering
    const keepIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    await handleGenerateChecklist(keepIndices);
    
    // Return the new indices - kept items are always at the beginning (0, 1, 2, ...)
    return new Set(keepIndices.map((_, idx) => idx));
  }, [handleGenerateChecklist, generatedRows.length]);

  return {
    // State
    userInput,
    setUserInput,
    chatMessages,
    isGeneratingChecklist,
    hasGeneratedChecklist,
    generatedRows,
    setGeneratedRows,
    wordPressPostsMetadata,
    sitemapInventoryLinks,
    siteKwHostedLink,
    lastInventorySentToAiCount,
    chatEndRef,
    
    // Actions
    handleGenerateChecklist,
    resetPromptGeneration,
    handleModifyChecklist,
    handleRegenerateUnselected,
  };
}

