import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { resolveEditorialCountsRangeForDashboard } from "@/lib/quarter-bounds";
import { buildQuarterTilesAfterWipe } from "@/hooks/use-quarter-editorial-counts";
import { postsStripLoading } from "@/lib/quarter-editorial-count-display";
import type { QuarterEditorialTileStats } from "@/lib/wordpress-api/types";

function mockSite(id: string): WordPressSite {
  return {
    id,
    name: "Test",
    siteUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    enabled: true,
  } as WordPressSite;
}

describe("useQuarterEditorialCounts refresh wipe", () => {
  it("buildQuarterTilesAfterWipe nulls totals even when previous tile had numbers", () => {
    const site = mockSite("s1");
    const monthKey = "2026-10";
    const resolveRange = (s: WordPressSite, now: Date) =>
      resolveEditorialCountsRangeForDashboard(s.editorialCountsPeriodStartYmd, monthKey, now);

    const prev: Record<string, QuarterEditorialTileStats> = {
      s1: {
        quarterLabel: "M10",
        loading: false,
        postsLive: 3,
        postsScheduled: 15,
        entityLive: 141,
        entityScheduled: 30,
        entityConfigured: true,
        entityCountsAvailable: true,
        countsPeriodAfterIso: "2026-10-01T06:00:00.000Z",
        countsPeriodEndExclusiveIso: "2026-11-01T06:00:00.000Z",
        countsPeriodMode: "calendar-month",
      },
    };

    const wiped = buildQuarterTilesAfterWipe([site], prev, resolveRange, new Date("2026-10-02T12:00:00"));
    const tile = wiped.s1;
    expect(tile.loading).toBe(true);
    expect(tile.postsLive).toBeNull();
    expect(tile.postsScheduled).toBeNull();
    expect(tile.entityLive).toBeNull();
    expect(tile.entityScheduled).toBeNull();
    expect(postsStripLoading(tile)).toBe(true);
  });
});
