import type { WordPressSite } from "@/components/integrations/types";

const COUNTRY_TO_DFS_LOCATION: Record<string, string> = {
  canada: "Canada",
  ca: "Canada",
  "united states": "United States",
  us: "United States",
  usa: "United States",
  "united kingdom": "United Kingdom",
  uk: "United Kingdom",
  australia: "Australia",
};

function dfsLocationFromCountry(country: string | undefined): string | undefined {
  if (!country?.trim()) return undefined;
  const key = country.trim().toLowerCase();
  return COUNTRY_TO_DFS_LOCATION[key];
}

/**
 * DataForSEO location_name for PPC research (country-level; city names are not in the PHP map).
 */
export function resolvePpcSiteLocationName(site: WordPressSite): string {
  const loc = site.locations?.find((l) => l.isDefault) ?? site.locations?.[0];
  const fromCountry = dfsLocationFromCountry(loc?.country);
  if (fromCountry) return fromCountry;

  const state = loc?.state?.trim().toUpperCase();
  if (state === "AB" || state === "BC" || state === "ON" || state === "QC" || state === "MB" || state === "SK") {
    return "Canada";
  }

  return "United States";
}

export function resolvePpcSiteLanguageCode(site: WordPressSite): string {
  const country = site.locations?.find((l) => l.isDefault)?.country ?? site.locations?.[0]?.country;
  if (country?.trim().toLowerCase() === "canada" || country?.trim().toLowerCase() === "ca") {
    return "en";
  }
  return "en";
}
