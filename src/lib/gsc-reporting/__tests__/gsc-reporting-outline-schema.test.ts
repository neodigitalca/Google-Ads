import { describe, expect, it } from "vitest";
import {
  GSC_OUTLINE_OPENROUTER_OPTS,
  GSC_OUTLINE_OUTPUT_LIMITS,
  GSC_REPORTING_OUTLINE_JSON_SCHEMA,
} from "@/lib/gsc-reporting/gsc-reporting-outline-schema";

describe("gsc-reporting-outline-schema", () => {
  it("uses strict json_schema response format (one pass)", () => {
    const fmt = GSC_OUTLINE_OPENROUTER_OPTS.responseFormat;
    expect(fmt.type).toBe("json_schema");
    if (fmt.type === "json_schema") {
      expect(fmt.json_schema.strict).toBe(true);
      expect(fmt.json_schema.name).toBe("gsc_reporting_outline");
    }
  });

  it("caps executiveSummary and topOpportunities size", () => {
    const props = GSC_REPORTING_OUTLINE_JSON_SCHEMA.properties as {
      executiveSummary: { maxLength: number };
      topOpportunities: { maxItems: number };
    };
    expect(props.executiveSummary.maxLength).toBe(GSC_OUTLINE_OUTPUT_LIMITS.executiveSummaryMaxChars);
    expect(props.topOpportunities.maxItems).toBe(GSC_OUTLINE_OUTPUT_LIMITS.topOpportunitiesMax);
    expect(GSC_OUTLINE_OUTPUT_LIMITS.topOpportunitiesMax).toBe(12);
  });
});
