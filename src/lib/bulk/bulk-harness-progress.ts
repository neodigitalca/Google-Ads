import type { CSVRow } from '@/lib/bulk/bulk-csv-parser';
import type { BulkProcessingOptions } from '@/lib/bulk/bulk-auto-generate-types';
import type { ExtraTextInventoryLinkRow } from '@/lib/content-generation/extra-text-inventory-links';
import {
  buildContentOptimizeHarnessPayload,
  buildGoogleImageEntitySapPipelineTitles,
  rowUsesGoogleImageFeatured,
} from '@/lib/overview/overview-content-optimize-pipeline';

export type BulkInternalLinkRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
  collection?: string;
  postType?: string;
};

export function bulkPostsToExtraTextLinkRows(posts: BulkInternalLinkRow[]): ExtraTextInventoryLinkRow[] {
  return posts.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    link: item.link,
    date_gmt: item.date_gmt,
    postType:
      item.collection === 'pages' || item.postType === 'page' ? ('page' as const) : ('post' as const),
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
    buildContentOptimizeHarnessPayload(rowIndex, sectionIndex, 'done', undefined, pipelineTitles),
  );
}

export function emitEntitySapPipelineHarnessDone(
  options: BulkProcessingOptions,
  rowIndex: number,
  row: Pick<CSVRow, 'featuredImage'>,
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
