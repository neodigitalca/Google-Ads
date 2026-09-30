import { describe, expect, it } from "vitest";
import { computeRemainingGenerateCount } from "@/lib/generator/generator-profile-remaining";

describe("computeRemainingGenerateCount", () => {
  it("subtracts detected entities from profile target", () => {
    expect(computeRemainingGenerateCount(15, 14)).toEqual({
      remaining: 1,
      detected: 14,
      usedFallbackTarget: false,
    });
  });

  it("returns zero when at target", () => {
    expect(computeRemainingGenerateCount(15, 15).remaining).toBe(0);
  });

  it("uses full target when detection unavailable", () => {
    expect(computeRemainingGenerateCount(15, null)).toEqual({
      remaining: 15,
      detected: null,
      usedFallbackTarget: true,
    });
  });
});
