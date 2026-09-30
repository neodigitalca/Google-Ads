import { WorkspacePill } from "@/components/shared/WorkspacePill";
import { getStoredSites, type WordPressSite } from "@/components/IntegrationsTab";
import type { ConnectedSiteSummary } from "@/components/integrations/types";
import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";
import {
  defaultBulkSitemapMode,
  normalizeBulkSitemapScopeTags,
  type BulkSitemapScopeTag,
} from "@/lib/bulk/bulk-sitemap-mode";

export type BulkSiteSitemapConfig = {
  sitemapType: BulkSitemapMode;
  scopeTags?: BulkSitemapScopeTag[];
};

export type BulkGeneratorSitemapMenuProps = {
  postDestination: WordPressPostDestination;
  connectedSite?: ConnectedSiteSummary | null;
  selectedWordPressSites: Set<string>;
  siteConfigs: Record<string, BulkSiteSitemapConfig>;
  setSiteConfigs: (
    value:
      | Record<string, BulkSiteSitemapConfig>
      | ((
          prev: Record<string, BulkSiteSitemapConfig>,
        ) => Record<string, BulkSiteSitemapConfig>),
  ) => void;
  isDisabled?: boolean;
  /** Keep pills visible when export destination is local (blog import). */
  showWhenLocal?: boolean;
};

function resolveTargetSite(connectedSite?: ConnectedSiteSummary | null): WordPressSite | null {
  if (!connectedSite) return null;
  const sites = getStoredSites();
  if (sites.length === 0) return null;
  const normalize = (url: string) =>
    url.trim().toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
  return sites.find((s) => normalize(s.siteUrl) === normalize(connectedSite.siteUrl)) ?? null;
}

const SCOPE_PILLS: Array<{ tag: BulkSitemapScopeTag; label: string }> = [
  { tag: "pages", label: "Pages" },
  { tag: "posts", label: "Posts" },
  { tag: "entities", label: "Entities" },
];

export function BulkGeneratorSitemapMenu({
  postDestination,
  connectedSite,
  selectedWordPressSites,
  siteConfigs,
  setSiteConfigs,
  isDisabled = false,
  showWhenLocal = false,
}: BulkGeneratorSitemapMenuProps) {
  if (postDestination === "local" && !showWhenLocal) {
    return null;
  }

  const targetSite = resolveTargetSite(connectedSite);
  if (!targetSite) {
    return null;
  }

  const selectedId = Array.from(selectedWordPressSites)[0] ?? targetSite.id;
  const entityAvailable = Boolean(targetSite.entitySitemapUrl?.trim());
  const scopeTags = normalizeBulkSitemapScopeTags(siteConfigs[selectedId]?.scopeTags);

  const toggleScopeTag = (tag: BulkSitemapScopeTag) => {
    if (isDisabled) return;
    if (tag === "entities" && !entityAvailable) return;
    setSiteConfigs((prev) => {
      const current = normalizeBulkSitemapScopeTags(prev[selectedId]?.scopeTags);
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return {
        ...prev,
        [selectedId]: {
          ...prev[selectedId],
          sitemapType: prev[selectedId]?.sitemapType ?? defaultBulkSitemapMode(),
          scopeTags: next,
        },
      };
    });
  };

  return (
    <div
      className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1"
      role="group"
      aria-label="Sitemap scope"
    >
      {SCOPE_PILLS.map(({ tag, label }) => (
        <WorkspacePill
          key={tag}
          label={label}
          active={scopeTags.includes(tag)}
          disabled={isDisabled || (tag === "entities" && !entityAvailable)}
          onClick={() => toggleScopeTag(tag)}
        />
      ))}
    </div>
  );
}
