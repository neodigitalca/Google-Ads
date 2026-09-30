import type { QuarterEditorialTileStats } from "@/lib/wordpress-api/types";

/** Same total as Properties row (live + scheduled in the editorial window). */
export function quarterEditorialEntityTotal(
  stats: QuarterEditorialTileStats | undefined,
): number | null {
  if (!stats?.entityConfigured || !stats.entityCountsAvailable) return null;
  if (stats.loading) return null;
  const live = stats.entityLive;
  const scheduled = stats.entityScheduled;
  if (typeof live === "number" && Number.isFinite(live) && typeof scheduled === "number" && Number.isFinite(scheduled)) {
    return live + scheduled;
  }
  if (typeof live === "number" && Number.isFinite(live)) return live;
  if (typeof scheduled === "number" && Number.isFinite(scheduled)) return scheduled;
  return null;
}

export function quarterEditorialPostTotal(
  stats: QuarterEditorialTileStats | undefined,
): number | null {
  if (!stats || stats.loading) return null;
  const live = stats.postsLive;
  const scheduled = stats.postsScheduled;
  if (typeof live === "number" && Number.isFinite(live) && typeof scheduled === "number" && Number.isFinite(scheduled)) {
    return live + scheduled;
  }
  if (typeof live === "number" && Number.isFinite(live)) return live;
  if (typeof scheduled === "number" && Number.isFinite(scheduled)) return scheduled;
  return null;
}

/** How many to generate this run: profile target minus already counted in the period. */
export function computeRemainingGenerateCount(
  profileTarget: number,
  detectedInPeriod: number | null | undefined,
): { remaining: number; detected: number | null; usedFallbackTarget: boolean } {
  const target = Math.max(1, Math.floor(profileTarget) || 1);
  if (detectedInPeriod == null || !Number.isFinite(detectedInPeriod)) {
    return { remaining: target, detected: null, usedFallbackTarget: true };
  }
  const detected = Math.max(0, Math.floor(detectedInPeriod));
  return { remaining: Math.max(0, target - detected), detected, usedFallbackTarget: false };
}
