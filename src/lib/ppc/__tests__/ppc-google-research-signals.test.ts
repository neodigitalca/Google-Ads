import { describe, expect, it } from "vitest";
import {
  normalizePpcGoogleResearchSignals,
  ppcResearchKeywordUnion,
} from "@/lib/ppc/ppc-google-research-signals";

describe("ppc-google-research-signals", () => {
  it("normalizes and dedupes signal lists", () => {
    const signals = normalizePpcGoogleResearchSignals({
      focusKeyword: "edmonton seo",
      gscQueries: [
        { text: "Edmonton SEO", clicks: 1 },
        { text: "edmonton seo", clicks: 2 },
      ],
      dfsKeywordIdeas: [{ text: "seo edmonton", source: "dfs_labs" }],
    });
    expect(signals.gscQueries).toHaveLength(1);
    expect(signals.gscQueries[0]?.text).toBe("Edmonton SEO");
    expect(signals.dfsKeywordIdeas[0]?.source).toBe("dfs_labs");
  });

  it("builds a keyword union for prompts", () => {
    const signals = normalizePpcGoogleResearchSignals({
      focusKeyword: "edmonton seo",
      gscQueries: [{ text: "edmonton seo agency" }],
      accountKeywords: [{ text: "edmonton seo" }],
    });
    const union = ppcResearchKeywordUnion(signals);
    expect(union).toContain("edmonton seo agency");
    expect(union).toContain("edmonton seo");
  });

  it("throws when focusKeyword is missing", () => {
    expect(() => normalizePpcGoogleResearchSignals({})).toThrow(/focusKeyword/i);
  });
});
