import type { WordPressSite } from "@/components/integrations/types";
import {
  filterPromptBulkSitemapBucketsByScopes,
  totalRowsInScopedBuckets,
  type BulkSitemapScopeTag,
} from "@/lib/bulk/bulk-sitemap-mode";
import {
  loadBulkSitemapInventoryForSite,
  type LoadBulkSitemapInventoryResult,
} from "@/lib/bulk/bulk-sitemap-inventory-session";
import {
  recreatePromptBulkSitemapInventoryLinks,
  type PromptBulkSitemapInventoryBuckets,
} from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import {
  buildPromptBulkSiteKwFromGscQueries,
  scrapePromptBulkSiteKwJson,
  type PromptBulkSiteKwScrapeResult,
} from "@/lib/bulk/prompt-bulk-site-kw-scrape";
import {
  getEntitySiteWarmCacheIfReady,
  isSitePrefetchStale,
  siteWarmCredentialsKey,
  type EntitySiteWarmBundle,
} from "@/lib/local-analysis/entity-site-warm-cache";

export type PromptBulkResolveSource = "session" | "warm" | "network";

export type ResolvePromptBulkInventoryResult = LoadBulkSitemapInventoryResult & {
  source: PromptBulkResolveSource;
};

export type ResolvePromptBulkSiteKwResult = PromptBulkSiteKwScrapeResult & {
  source: PromptBulkResolveSource;
};

export function promptBulkScopeCacheKey(scopeTags: BulkSitemapScopeTag[] | undefined): string {
  const normalized = [...(scopeTags ?? [])].sort().join(",");
  return normalized || "all";
}

export function promptBulkSessionCacheKey(
  site: WordPressSite,
  scopeTags: BulkSitemapScopeTag[] | undefined,
): string {
  return `${site.id}|${siteWarmCredentialsKey(site)}|${promptBulkScopeCacheKey(scopeTags)}`;
}

export function canUseWarmPromptBulkData(
  site: WordPressSite,
  bundle: EntitySiteWarmBundle | null | undefined,
): bundle is EntitySiteWarmBundle {
  if (!bundle || bundle.error) return false;
  if (isSitePrefetchStale(bundle)) return false;
  const credKey = siteWarmCredentialsKey(site);
  if (bundle.credentialsKey !== credKey) return false;
  if (bundle.counts.inventoryTotal <= 0) return false;
  if (bundle.counts.gscQueries <= 0) return false;
  if (bundle.gsc.queries.length === 0) return false;
  return true;
}

function inventoryFromWarmBundle(
  site: WordPressSite,
  bundle: EntitySiteWarmBundle,
  scopeTags: BulkSitemapScopeTag[] | undefined,
): LoadBulkSitemapInventoryResult {
  const siteUrl = site.siteUrl?.trim() ?? "";
  const scopedBuckets = filterPromptBulkSitemapBucketsByScopes(
    bundle.inventory.buckets,
    scopeTags,
  );
  const totalRows = totalRowsInScopedBuckets(scopedBuckets);
  const sources = bundle.inventory.sources;
  const links =
    scopeTags?.length
      ? recreatePromptBulkSitemapInventoryLinks(siteUrl, scopedBuckets, sources)
      : bundle.inventory.links.length > 0
        ? bundle.inventory.links
        : recreatePromptBulkSitemapInventoryLinks(siteUrl, scopedBuckets, sources);

  return {
    links,
    buckets: scopedBuckets,
    totalRows,
    sources,
    errors: bundle.inventory.errors,
    postsMetadata: bundle.inventory.postsMetadata,
  };
}

export async function resolvePromptBulkInventory(
  site: WordPressSite,
  scopeTags: BulkSitemapScopeTag[] | undefined,
  onProgress?: (message: string) => void,
): Promise<ResolvePromptBulkInventoryResult> {
  const warm = getEntitySiteWarmCacheIfReady(site.id);
  if (canUseWarmPromptBulkData(site, warm)) {
    onProgress?.("Using cached site inventory");
    return {
      ...inventoryFromWarmBundle(site, warm, scopeTags),
      source: "warm",
    };
  }

  onProgress?.("Loading Posts, Pages, and SAP sitemap inventory");
  const inventory = await loadBulkSitemapInventoryForSite(site, onProgress, {
    scopeTags: scopeTags?.length ? scopeTags : undefined,
  });
  return { ...inventory, source: "network" };
}

export async function resolvePromptBulkSiteKw(
  site: WordPressSite,
  warmBundle: EntitySiteWarmBundle | null,
  onProgress?: (message: string) => void,
): Promise<ResolvePromptBulkSiteKwResult> {
  if (canUseWarmPromptBulkData(site, warmBundle)) {
    onProgress?.("Using cached GSC keywords");
    return {
      ...buildPromptBulkSiteKwFromGscQueries(site, warmBundle.gsc.queries),
      source: "warm",
    };
  }

  onProgress?.("Loading GSC keywords");
  const scraped = await scrapePromptBulkSiteKwJson(site);
  return { ...scraped, source: "network" };
}

/** Compare scoped bucket JSON to avoid revoking identical hosted links. */
export function promptBulkInventoryBucketsSignature(
  buckets: PromptBulkSitemapInventoryBuckets,
): string {
  return `${buckets.pages.rowCount}|${buckets.pages.json.length}|${buckets.posts.rowCount}|${buckets.posts.json.length}|${buckets.sap.rowCount}|${buckets.sap.json.length}`;
}
