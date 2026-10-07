import { describe, expect, it } from "vitest";
import {
  buildGscQuerySparklineSvg,
  summarizeQueryDailyDays,
} from "@/lib/gsc-reporting/gsc-query-sparkline";

describe("gsc-query-sparkline", () => {
  it("builds SVG with impression and position polylines", () => {
    const svg = buildGscQuerySparklineSvg("shades near me", [
      { date: "2026-09-01", clicks: 0, impressions: 10, position: 30 },
      { date: "2026-09-29", clicks: 0, impressions: 40, position: 4 },
    ]);
    expect(svg).toContain("<svg");
    expect(svg).toContain("shades near me");
    expect(svg).toContain("<polyline");
  });

  it("summarizes best position day and last day", () => {
    const stats = summarizeQueryDailyDays([
      { date: "2026-09-01", clicks: 0, impressions: 50, position: 28 },
      { date: "2026-09-29", clicks: 0, impressions: 1, position: 4 },
    ]);
    expect(stats.bestPositionDay?.position).toBe(4);
    expect(stats.lastDay?.date).toBe("2026-09-29");
  });
});
