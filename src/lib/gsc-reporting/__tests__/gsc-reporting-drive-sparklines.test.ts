import { describe, expect, it } from "vitest";
import { rewriteSparklinePlaceholdersInMarkdown } from "@/lib/gsc-reporting/gsc-reporting-drive-sparklines";

describe("rewriteSparklinePlaceholdersInMarkdown", () => {
  it("replaces sparkline placeholders with Drive URLs", () => {
    const md = "![shades near me daily trend](sparkline:gsc-sparkline-shades-near-me.svg)";
    const map = new Map([["gsc-sparkline-shades-near-me.svg", "https://drive.google.com/uc?export=view&id=abc"]]);
    const out = rewriteSparklinePlaceholdersInMarkdown(md, map);
    expect(out).toContain("https://drive.google.com/uc?export=view&id=abc");
    expect(out).not.toContain("sparkline:");
  });
});
