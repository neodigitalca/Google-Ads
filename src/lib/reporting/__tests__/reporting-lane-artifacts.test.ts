import { describe, expect, it } from "vitest";
import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import {
  laneReportRowShouldMount,
  lanesForWorkspaceMode,
  primaryReportingLaneForMode,
  reportingLaneCountForMode,
  reportingPlaceholderRowCountForVisibleReportRows,
} from "@/lib/reporting/reporting-lane-artifacts";

describe("reporting lane layout", () => {
  it("shows all placeholders when idle (no report row mounted)", () => {
    expect(reportingPlaceholderRowCountForVisibleReportRows(0)).toBe(BULK_GENERATOR_EMPTY_ROW_COUNT);
    expect(laneReportRowShouldMount({ hasReport: false })).toBe(false);
  });

  it("trims placeholders when report rows are visible", () => {
    expect(reportingLaneCountForMode("seo")).toBe(1);
    expect(reportingPlaceholderRowCountForVisibleReportRows(1)).toBe(BULK_GENERATOR_EMPTY_ROW_COUNT - 1);
    expect(reportingLaneCountForMode("both")).toBe(2);
    expect(reportingPlaceholderRowCountForVisibleReportRows(2)).toBe(BULK_GENERATOR_EMPTY_ROW_COUNT - 2);
  });

  it("mounts row only after generate finishes (not while loading)", () => {
    expect(laneReportRowShouldMount({ hasReport: false })).toBe(false);
    expect(laneReportRowShouldMount({ hasReport: true })).toBe(true);
    expect(laneReportRowShouldMount({ hasReport: true }, { mode: "both", runBusy: true })).toBe(false);
    expect(laneReportRowShouldMount({ hasReport: true }, { mode: "both", runBusy: false })).toBe(true);
  });

  it("maps mode to lanes", () => {
    expect(lanesForWorkspaceMode("both")).toEqual(["seo", "ppc"]);
    expect(primaryReportingLaneForMode("ppc")).toBe("ppc");
    expect(primaryReportingLaneForMode("seo")).toBe("seo");
  });
});
