import { describe, expect, it } from "vitest";
import {
  deriveQuerySpotlights,
  querySpotlightNarrativeFileContent,
} from "@/lib/gsc-reporting/gsc-query-spotlight";
import type { GscQueryPerfRow } from "@/lib/gsc-reporting/gsc-reporting-fetch";

describe("deriveQuerySpotlights", () => {
  it("classifies shades near me style expansion (136 vs 4 imp, position dilution)", () => {
    const primary: GscQueryPerfRow[] = [
      {
        query: "shades near me",
        clicks: 0,
        impressions: 136,
        ctr: 0,
        position: 32.6,
      },
    ];
    const compare: GscQueryPerfRow[] = [
      {
        query: "shades near me",
        clicks: 0,
        impressions: 4,
        ctr: 0,
        position: 15,
      },
    ];
    const spotlights = deriveQuerySpotlights(primary, compare);
    expect(spotlights).toHaveLength(1);
    expect(spotlights[0]!.pattern).toBe("impression_footprint_expansion");
    expect(spotlights[0]!.forbiddenFraming).toContain("visibility loss");
    const file = querySpotlightNarrativeFileContent(spotlights);
    expect(file).toContain("QUERY_SPOTLIGHT_NARRATIVE");
    expect(file).toContain("shades near me");
    expect(file).toContain("impression_footprint_expansion");
  });

  it("skips low-impression queries", () => {
    const primary: GscQueryPerfRow[] = [
      { query: "tiny term", clicks: 0, impressions: 10, ctr: 0, position: 20 },
    ];
    const compare: GscQueryPerfRow[] = [
      { query: "tiny term", clicks: 0, impressions: 2, ctr: 0, position: 10 },
    ];
    expect(deriveQuerySpotlights(primary, compare)).toHaveLength(0);
  });
});
