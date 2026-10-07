import type { WordPressSite } from "@/components/integrations/types";

export const REPORTING_SHORTCUT_PROFILE_TAG_ID = "reporting-shortcut";

export type PropertyProfileTagOption = {
  id: string;
  label: string;
};

export const PROPERTY_PROFILE_TAG_OPTIONS: PropertyProfileTagOption[] = [
  { id: REPORTING_SHORTCUT_PROFILE_TAG_ID, label: "Reporting shortcut" },
];

const VALID_TAG_IDS = new Set(PROPERTY_PROFILE_TAG_OPTIONS.map((o) => o.id));

export function normalizeProfileTags(tags: string[] | undefined | null): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const id = raw.trim();
    if (!id || !VALID_TAG_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function siteHasProfileTag(site: WordPressSite, tagId: string): boolean {
  return normalizeProfileTags(site.profileTags).includes(tagId);
}

/** Clients that get the Properties row reporting shortcut (display name match). */
export const REPORTING_SHORTCUT_CLIENT_LABELS = [
  "Tailored Interiors",
  "Blinds West",
  "Blind Magic",
  "In The Shade",
  "DM Interiors",
  "Superior Blinds",
  "Blind Spot",
  "Interiors By Laura",
  "KWB",
  "You Junk It",
] as const;

const REPORTING_NAME_CONTAINS: Partial<Record<(typeof REPORTING_SHORTCUT_CLIENT_LABELS)[number], string>> = {
  "In The Shade": "in the shade",
  "Interiors By Laura": "interiors by laura",
  "You Junk It": "you junk it",
};

/** Integrations property name when the reporting roster uses a different Ads account label. */
const REPORTING_SITE_NAME_ALIASES: Partial<
  Record<(typeof REPORTING_SHORTCUT_CLIENT_LABELS)[number], string[]>
> = {
  "Blind Spot": ["Shutter Spot"],
};

function normalizePropertyDisplayName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function propertyNameMatchesReportingShortcutClient(
  siteName: string,
  clientLabel: (typeof REPORTING_SHORTCUT_CLIENT_LABELS)[number],
): boolean {
  const n = normalizePropertyDisplayName(siteName);
  const contains = REPORTING_NAME_CONTAINS[clientLabel];
  if (contains) {
    return n.includes(normalizePropertyDisplayName(contains));
  }
  if (n === normalizePropertyDisplayName(clientLabel)) {
    return true;
  }
  const aliases = REPORTING_SITE_NAME_ALIASES[clientLabel];
  if (!aliases?.length) return false;
  return aliases.some((alias) => n === normalizePropertyDisplayName(alias));
}

/** Profile tag or roster name on the reporting client list. */
export function propertyShowsReportingShortcut(site: WordPressSite): boolean {
  if (siteHasProfileTag(site, REPORTING_SHORTCUT_PROFILE_TAG_ID)) {
    return true;
  }
  return REPORTING_SHORTCUT_CLIENT_LABELS.some((label) =>
    propertyNameMatchesReportingShortcutClient(site.name, label),
  );
}

export function toggleProfileTag(tags: string[] | undefined, tagId: string): string[] {
  const normalized = normalizeProfileTags(tags);
  if (normalized.includes(tagId)) {
    return normalized.filter((t) => t !== tagId);
  }
  return [...normalized, tagId];
}
