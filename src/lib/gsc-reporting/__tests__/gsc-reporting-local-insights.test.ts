import { describe, expect, it } from "vitest";
import {
  gscReportingSupplementsEmpty,
  gscReportingSupplementsHasContent,
} from "@/lib/gsc-reporting/gsc-reporting-supplements-types";

describe("gscReportingSupplementsHasContent", () => {
  it("returns false for empty supplements", () => {
    expect(gscReportingSupplementsHasContent(gscReportingSupplementsEmpty())).toBe(false);
    expect(gscReportingSupplementsHasContent(undefined)).toBe(false);
  });

  it("returns true when CSV or images present", () => {
    expect(
      gscReportingSupplementsHasContent({
        localDominatorCsv: "Keyword,Rank\na,1",
        images: [],
      }),
    ).toBe(true);
    expect(
      gscReportingSupplementsHasContent({
        images: [{ name: "grid.png", dataUrl: "data:image/png;base64,abc" }],
      }),
    ).toBe(true);
  });
});
