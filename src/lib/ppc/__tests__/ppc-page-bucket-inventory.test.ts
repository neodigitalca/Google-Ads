import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { ppcPageBucketCollections } from "@/lib/ppc/ppc-page-bucket-inventory";

function neoDigitalUntaggedSite(): WordPressSite {
  return {
    id: "neo",
    name: "Neo Digital",
    siteUrl: "https://neodigital.ca",
    username: "user",
    appPassword: "pass",
    connectedAt: Date.now(),
    entitySitemapUrl: "https://neodigital.ca/service-area-sitemap.xml",
  } as WordPressSite;
}

function taggedPagesSite(): WordPressSite {
  return {
    id: "shutterspot",
    name: "Shutter Spot",
    siteUrl: "https://shutterspot.com",
    username: "user",
    appPassword: "pass",
    connectedAt: Date.now(),
    sitemaps: {
      mainSitemapUrl: "https://shutterspot.com/sitemap_index.xml",
      detectedAt: Date.now(),
      type: "index",
      childSitemaps: [
        "https://shutterspot.com/page-sitemap.xml",
        "https://shutterspot.com/hunter-douglas-sitemap.xml",
      ],
      sitemapTags: {
        "https://shutterspot.com/page-sitemap.xml": ["pages"],
        "https://shutterspot.com/hunter-douglas-sitemap.xml": ["pages"],
      },
    },
  } as WordPressSite;
}

describe("ppcPageBucketCollections", () => {
  it("always includes the WordPress pages collection when no Pages sitemap is tagged", () => {
    expect(ppcPageBucketCollections(neoDigitalUntaggedSite())).toEqual(["pages"]);
  });

  it("keeps tagged Pages CPT collections after pages", () => {
    expect(ppcPageBucketCollections(taggedPagesSite())).toEqual(["pages", "hunter-douglas"]);
  });
});
