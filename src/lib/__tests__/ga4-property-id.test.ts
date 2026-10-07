import { describe, expect, it } from "vitest";
import { normalizeGa4PropertyIdForApi } from "@/lib/ga4-property-id";

describe("normalizeGa4PropertyIdForApi", () => {
  it("accepts numeric property id", () => {
    expect(normalizeGa4PropertyIdForApi("498324127")).toBe("498324127");
  });

  it("strips properties/ prefix", () => {
    expect(normalizeGa4PropertyIdForApi("properties/123456789")).toBe("123456789");
  });

  it("rejects measurement id", () => {
    expect(() => normalizeGa4PropertyIdForApi("G-ABC123")).toThrow(/Measurement ID/i);
  });
});
