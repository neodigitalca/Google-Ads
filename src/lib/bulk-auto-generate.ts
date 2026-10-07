import { resolveSerpLocationName } from '@/lib/llm-audit/fetch-seo-content-brief-wave';
import { BulkFileManager, type BulkGeneratedFile } from './bulk-file-manager';
import type {
  KeywordAnalysisComplete,
  KeywordAnalysisOptions,
} from './keyword-types';
import { hasCsvFilledWikipediaUrl } from './bulk/prefilled-bulk-row-contract';
import { buildBlogImportKeywordResearchStub } from './bulk/blog-import-parse';
import type { BulkProcessingOptions } from './bulk/bulk-auto-generate-types';
import type { CSVRow } from './bulk/bulk-csv-parser';

export {
  buildSitesToPostFromPosting,
  prefetchBulkWordPressLinkValidationForRun,
  clearBulkUploadValidationCache,
} from '@/lib/bulk/bulk-wordpress-link-prefetch';
export {
  buildBulkSelectedKeywordArtifactPayload,
  resolveRankMathFromKeywordResearch,
} from '@/lib/bulk/bulk-keyword-research-artifacts';

export { emitEntitySapPipelineHarnessDone } from '@/lib/bulk/bulk-harness-progress';

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

export {
  addKeywordResearchSnapshotToBulkFiles,
  generateBlueprintAndContent,
} from '@/lib/bulk/bulk-row-pipeline';

function bulkRowSerpLocationName(row: {
  title?: string;
  keyword?: string;
  modifier?: string;
  prompt_modifier?: string;
}): string {
  const geo = [row.title, row.keyword, row.prompt_modifier, row.modifier]
    .filter(Boolean)
    .join(' ');
  return resolveSerpLocationName('', geo);
}

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
    if (
      !options.skipWikipediaLookup
      && row.entity
      && row.entity.trim()
      && !hasCsvFilledWikipediaUrl(row)
    ) {
      options.onProgress?.(rowIndex, 0, `Fetching Wikipedia content for "${row.entity}"...`);

      try {
        const { checkWikipediaPageExists } = await import('./wikipedia-api');
        const entityCheck = await checkWikipediaPageExists(row.entity.trim());

        if (!entityCheck.exists) {
          console.warn(`[Bulk Generator] Entity "${row.entity}" does not exist on Wikipedia. Skipping Wikipedia content fetch.`);
          options.onProgress?.(rowIndex, 0, `Entity "${row.entity}" not found on Wikipedia, skipping...`);
        } else {
          let wikipediaChunks: unknown[] = [];
          let retries = 3;
          let lastError: Error | null = null;

          while (retries > 0) {
            try {
              const { fetchWikipediaContent } = await import('./wikipedia-api');
              wikipediaChunks = await fetchWikipediaContent(row.entity.trim());
              break;
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              retries--;

              if (retries === 0) {
                console.error(`[Bulk Generator] Failed to fetch Wikipedia content for "${row.entity}" after retries:`, lastError);
                options.onProgress?.(rowIndex, 0, `Failed to fetch Wikipedia content for "${row.entity}", continuing without it...`);
              } else {
                const delay = 1000 * (4 - retries);
                options.onProgress?.(rowIndex, 0, `Retrying Wikipedia fetch for "${row.entity}" (${4 - retries}/3)...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
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
