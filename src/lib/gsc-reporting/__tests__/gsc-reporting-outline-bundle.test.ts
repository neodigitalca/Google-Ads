import { describe, expect, it } from "vitest";
import {
  bundleGscOutlineFilesForPrompt,
  selectGscOutlineSourceFiles,
} from "@/lib/gsc-reporting/gsc-reporting-outline-bundle";

describe("gsc-reporting-outline-bundle", () => {
  it("drops indexed page URL inventories from outline input", () => {
    const files = [
      { name: "Site-totals-MoM.csv", content: "Period,Clicks\nAug,1" },
      { name: "Indexed-pages-urls-current.csv", content: "url\nhttps://example.com/a\n".repeat(500) },
      { name: "Indexed-pages-urls-period-b.csv", content: "url\nhttps://example.com/b\n".repeat(500) },
    ];
    const selected = selectGscOutlineSourceFiles(files);
    expect(selected.map((f) => f.name)).toEqual(["Site-totals-MoM.csv"]);
  });

  it("selects period progress CSVs instead of MoM compare files", () => {
    const files = [
      { name: "Site-totals-by-month.csv", content: "Month,Clicks\n2026-09,10" },
      { name: "Queries-Period.csv", content: "query,clicks\na,1" },
      { name: "Pages-Period.csv", content: "page,clicks\n/,1" },
      { name: "Site-totals-MoM.csv", content: "should-not-pick\n" },
    ];
    const selected = selectGscOutlineSourceFiles(files, "period_progress");
    expect(selected.map((f) => f.name)).toEqual([
      "Site-totals-by-month.csv",
      "Queries-Period.csv",
      "Pages-Period.csv",
    ]);
  });

  it("keeps full Queries-MoM rows for outline prompt", () => {
    const rows = ["query,clicks", ...Array.from({ length: 600 }, (_, i) => `q${i},${i}`)].join("\n");
    const selected = selectGscOutlineSourceFiles([
      { name: "Site-totals-MoM.csv", content: "Period,Clicks\nAug,1" },
      { name: "Queries-MoM.csv", content: rows },
    ]);
    const queries = selected.find((f) => f.name === "Queries-MoM.csv");
    expect(queries?.content).toBe(rows);
  });

  it("bundleGscOutlineFilesForPrompt includes full bundled CSV text (no char cap)", () => {
    const body = "x".repeat(12_000);
    const bundled = bundleGscOutlineFilesForPrompt([
      { name: "Site-totals-MoM.csv", content: "Period,Clicks\nAug,1" },
      { name: "Queries-MoM.csv", content: `query,clicks\n${body}` },
    ]);
    expect(bundled.truncated).toBe(false);
    expect(bundled.text).toContain(body);
  });
});
