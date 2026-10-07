import { describe, expect, it } from "vitest";
import { GscReportingSectionRow } from "@/components/research/reporting/GscReportingSectionRow";

describe("GscReportingSectionRow", () => {
  it("exports a row component (no inline markdown preview)", () => {
    expect(typeof GscReportingSectionRow).toBe("function");
  });
});
