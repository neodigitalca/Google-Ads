import { describe, expect, it } from "vitest";
import { sanitizeImageFilename } from "@/lib/image-filename-generator";

describe("sanitizeImageFilename", () => {
  it("builds a slug from title text", () => {
    expect(sanitizeImageFilename("Roman Shades Cost Factors")).toBe(
      "roman-shades-cost-factors",
    );
  });
});
