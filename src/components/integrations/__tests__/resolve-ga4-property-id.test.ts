import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { inferGa4PropertyIdFromSiteFields } from "@/components/integrations/storage";

function site(partial: Partial<WordPressSite>): WordPressSite {
  return {
    id: "test",
    name: "Test",
    siteUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    connectedAt: 0,
    ...partial,
  };
}

describe("inferGa4PropertyIdFromSiteFields", () => {
  it("uses ga4PropertyId when set", () => {
    expect(
      inferGa4PropertyIdFromSiteFields(site({ ga4PropertyId: "498324127", googleAdsCustomerId: "5619137403" })),
    ).toBe("498324127");
  });

  it("does not use googleAdsCustomerId", () => {
    expect(inferGa4PropertyIdFromSiteFields(site({ googleAdsCustomerId: "498324127" }))).toBe("");
  });
});
