import React from "react";
import { cn } from "@/lib/utils";
import type { WordPressSite } from "../types";
import { PropertySiteAvatar } from "./PropertySiteAvatar";
import { WordPressCardActions } from "./WordPressCardActions";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import {
  truncateWordpressSiteUrlLabel,
  wordpressSiteDomainLabel,
} from "./wordpress-site-domain-label";

export type PropertyOverviewPanelProps = {
  site: WordPressSite;
  isTesting: boolean;
  isDetecting: boolean;
  isExtractingNAPAndGraph: boolean;
  onTest: () => void;
  onDetect: () => void;
  onExtractNAPAndGraph?: () => void;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
};

function connectionStatusLabel(site: WordPressSite): string {
  if (site.enabled === false) return "Disabled";
  if (site.connectionStatus === "success") return "Connected";
  if (site.connectionStatus === "failed") return "Connection failed";
  if (site.connectionStatus === "testing") return "Testing…";
  return "Not tested";
}

function formatLastTested(ts?: number): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function sitemapSummary(site: WordPressSite): string {
  if (!site.sitemaps) return "—";
  if (site.sitemaps.type === "index") {
    const n = site.sitemaps.childSitemaps?.length ?? 0;
    return `${n} child sitemap${n === 1 ? "" : "s"}`;
  }
  const n = site.sitemaps.urls?.length ?? 0;
  return `${n} URL${n === 1 ? "" : "s"}`;
}

export function PropertyOverviewPanel({
  site,
  isTesting,
  isDetecting,
  isExtractingNAPAndGraph,
  onTest,
  onDetect,
  onExtractNAPAndGraph,
  onPatchSite,
}: PropertyOverviewPanelProps) {
  const displayName = wordpressSiteDisplayName(site);
  const publicUrl = getPublicSiteUrl(site);
  const urlLabel = truncateWordpressSiteUrlLabel(wordpressSiteDomainLabel(publicUrl));

  return (
    <div className="grid min-h-0 w-full min-w-0 gap-4 lg:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-3 bg-zinc-950 p-3">
        <div className="flex flex-col items-center gap-2 text-center">
          <PropertySiteAvatar site={site} size="lg" />
          <div className="min-w-0 w-full">
            <p className="text-base font-semibold leading-snug text-white">{displayName}</p>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-base text-zinc-400 hover:text-white"
            >
              {urlLabel}
            </a>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-base">
          <div className="flex flex-col gap-0.5">
            <dt className="text-zinc-400">WordPress</dt>
            <dd className="m-0 font-medium tabular-nums text-white">{connectionStatusLabel(site)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-zinc-400">Last tested</dt>
            <dd className="m-0 font-medium tabular-nums text-white">{formatLastTested(site.lastTested)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-zinc-400">Sitemaps</dt>
            <dd className="m-0 font-medium text-white">{sitemapSummary(site)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-zinc-400">GA4</dt>
            <dd className="m-0 font-medium text-white">
              {site.ga4PropertyId?.trim() ? "Configured" : "Not set"}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-zinc-400">GBP location</dt>
            <dd className="m-0 font-medium text-white">
              {site.gbpLocationId?.trim() ? "Configured" : "Not set"}
            </dd>
          </div>
        </dl>
      </aside>

      <div className={cn("flex min-h-0 min-w-0 flex-col")}>
        <WordPressCardActions
          site={site}
          isTesting={isTesting}
          isDetecting={isDetecting}
          isExtractingNAPAndGraph={isExtractingNAPAndGraph}
          onTest={onTest}
          onDetect={onDetect}
          onExtractNAPAndGraph={onExtractNAPAndGraph}
          onPatchSite={onPatchSite}
          tone="propertyBlack"
          layout="overviewDashboard"
        />
      </div>
    </div>
  );
}
