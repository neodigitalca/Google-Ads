import { describe, expect, it } from "vitest";
import {
  buildGscReportingSemMarkdownBlock,
  buildSemrushPositionTrackingMarkdownTable,
  buildSemrushPositionTrackingPeriodMarkdownTable,
  GSC_REPORTING_SEM_H2,
  GSC_REPORTING_SEMRUSH_TABLE_ROW_LIMIT,
  spliceSemPositionTrackingAfterSearchPerformance,
} from "@/lib/gsc-reporting/gsc-reporting-semrush-append";
import type { GscReportingSectionResult } from "@/lib/gsc-reporting/gsc-reporting-types";

describe("buildSemrushPositionTrackingMarkdownTable", () => {
  it("renders keyword rows with position change column", () => {
    const md = buildSemrushPositionTrackingMarkdownTable([
      {
        keyword: "blinds near me",
        primaryPosition: 5,
        comparePosition: 8,
        change: 3,
      },
    ]);
    expect(md).toContain("blinds near me");
    const mdWithLabels = buildSemrushPositionTrackingMarkdownTable(
      [
        {
          keyword: "blinds near me",
          primaryPosition: 5,
          comparePosition: 8,
          change: 3,
        },
      ],
      { primary: "Jul 1–Sep 30, 2026", compare: "Jul 1–Sep 30, 2025" },
    );
    expect(mdWithLabels).toContain("Jul 1–Sep 30, 2026");
    expect(mdWithLabels).toContain("Jul 1–Sep 30, 2025");
    expect(mdWithLabels).toContain("| Δ |");
    expect(md).toContain("| 5 |");
    expect(md).toContain("| 8 |");
    expect(md).toContain("| +3 |");
  });

  it("period progress table has keyword and position only", () => {
    const md = buildSemrushPositionTrackingPeriodMarkdownTable([
      { keyword: "alpha", primaryPosition: 8, comparePosition: 3, change: -5 },
      { keyword: "beta", primaryPosition: 2, comparePosition: 10, change: 8 },
    ]);
    expect(md).toContain("| Kw | Pos |");
    expect(md).not.toContain("Δ");
    expect(md).not.toContain("| 3 |");
    const betaLine = md.split("\n").find((line) => line.includes("beta"));
    expect(betaLine).toContain("| 2 |");
  });

  it("caps injected rows at ten", () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({
      keyword: `kw-${i}`,
      primaryPosition: 10,
      comparePosition: 12,
      change: 2,
    }));
    const md = buildSemrushPositionTrackingMarkdownTable(rows);
    const dataLines = md.split("\n").filter((line) => line.startsWith("| kw-"));
    expect(dataLines).toHaveLength(GSC_REPORTING_SEMRUSH_TABLE_ROW_LIMIT);
  });
});

describe("buildGscReportingSemMarkdownBlock", () => {
  it("humanizes Semrush authorize JSON errors", () => {
    const md = buildGscReportingSemMarkdownBlock({
      rows: [],
      skipped: true,
      reason: "api_error",
      message: '{"error":"couldn\'t authorize user","status":"error"}',
      primaryLabel: "Jul 1, 2026 to Sep 30, 2026",
      compareLabel: "Jul 1, 2025 to Sep 30, 2025",
    });
    expect(md).toContain("v3 API key");
    expect(md).not.toContain("trace_id");
  });

  it("uses SEM H2 and unavailable line when skipped", () => {
    const md = buildGscReportingSemMarkdownBlock({
      rows: [],
      skipped: true,
      reason: "no_api_key",
      primaryLabel: "Jul 1, 2026 to Sep 30, 2026",
      compareLabel: "Jul 1, 2025 to Sep 30, 2025",
    });
    expect(md).toContain(GSC_REPORTING_SEM_H2);
    expect(md).toContain("Semrush position tracking unavailable");
    expect(md).toContain("Semrush API key missing");
    expect(md).not.toContain("no_api_key");
  });
});

describe("spliceSemPositionTrackingAfterSearchPerformance", () => {
  it("inserts SEM block after search performance section", () => {
    const markdown = [
      "## Executive Summary",
      "Summary text",
      "",
      "## Search Performance Compared Month Over Month",
      "KPI table",
      "",
      "## Key Performance Insights",
      "Insights",
    ].join("\n");

    const sectionResults = [
      {
        index: 0,
        plan: { id: "search_performance_period", h2Title: "Search Performance Compared Month Over Month", kind: "search_performance_period", ragQuery: "" },
        markdownBlock: "## Search Performance Compared Month Over Month\n\nKPI table",
      },
    ] as GscReportingSectionResult[];

    const out = spliceSemPositionTrackingAfterSearchPerformance(
      markdown,
      sectionResults,
      "## SEM: Semrush Position Tracking\n\nTable here",
    );

    expect(out.indexOf("Search Performance")).toBeLessThan(out.indexOf("SEM"));
    expect(out.indexOf("SEM")).toBeLessThan(out.indexOf("Key Performance Insights"));
  });
});
