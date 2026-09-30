import { describe, expect, it } from "vitest";
import { gscKeywordsForEntity, mergeEntityKeywordWithGsc } from "@/lib/entity/entity-gsc-keywords";

describe("entity GSC keyword merge", () => {
  it("appends unique GSC queries to the base keyword", () => {
    expect(mergeEntityKeywordWithGsc("solar", ["solar edmonton", "Solar Edmonton"])).toBe(
      "solar, solar edmonton",
    );
  });

  it("prefers queries that mention the entity name", () => {
    const out = gscKeywordsForEntity("Edmonton", [
      "solar panels",
      "edmonton neighborhoods",
      "best coffee",
    ]);
    expect(out[0]?.toLowerCase()).toContain("edmonton");
  });
});
