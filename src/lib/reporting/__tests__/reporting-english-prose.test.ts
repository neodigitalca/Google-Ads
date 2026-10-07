import { describe, expect, it } from "vitest";
import { getGscReportingSectionSystemPrompt } from "@/lib/gsc-reporting/gsc-reporting-section-prompts";
import { REPORTING_ENGLISH_PROSE_RULES } from "@/lib/reporting/reporting-english-prose";

describe("REPORTING_ENGLISH_PROSE_RULES", () => {
  it("is included in GSC section system prompts", () => {
    const prompt = getGscReportingSectionSystemPrompt("executive_summary", "mom");
    expect(prompt).toContain("ENGLISH PROSE");
    expect(REPORTING_ENGLISH_PROSE_RULES).toMatch(/Calgary's/);
    expect(REPORTING_ENGLISH_PROSE_RULES).toMatch(/the site's/);
  });
});
