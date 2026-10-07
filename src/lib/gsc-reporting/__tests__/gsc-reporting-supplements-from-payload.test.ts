import { describe, expect, it } from "vitest";
import { gscReportingSupplementsFromExecutionPayload } from "@/lib/gsc-reporting/gsc-reporting-supplements-from-payload";

describe("gscReportingSupplementsFromExecutionPayload", () => {
  it("decodes csv base64 and images", () => {
    const csv = "Keyword,Rank\ntest,3";
    const b64 = btoa(csv);
    const out = gscReportingSupplementsFromExecutionPayload({
      localDominatorCsvBase64: b64,
      localInsightsImages: [
        { fileName: "map.png", mime: "image/png", contentBase64: "aa==" },
      ],
    });
    expect(out?.localDominatorCsv).toBe(csv);
    expect(out?.images[0]?.dataUrl).toContain("data:image/png;base64,aa==");
  });
});
