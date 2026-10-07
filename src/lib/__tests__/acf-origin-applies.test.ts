import { describe, expect, it } from "vitest";
import { acfOriginAppliesForSitemapType } from "@/lib/acf-origin-applies";

describe("acfOriginAppliesForSitemapType", () => {
  it("applies only to entity sitemap rows", () => {
    expect(acfOriginAppliesForSitemapType("entity")).toBe(true);
    expect(acfOriginAppliesForSitemapType("post")).toBe(false);
    expect(acfOriginAppliesForSitemapType(undefined)).toBe(false);
  });
});
