/**
 * GSC-style dual-metric sparkline (impressions + position) as SVG.
 */
export type GscQueryDailyDay = {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type GscQueryDailyStats = {
  bestPositionDay: { date: string; position: number } | null;
  lastDay: GscQueryDailyDay | null;
  periodAvgPosition: number | null;
};

export function summarizeQueryDailyDays(days: GscQueryDailyDay[]): GscQueryDailyStats {
  if (days.length === 0) {
    return { bestPositionDay: null, lastDay: null, periodAvgPosition: null };
  }
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let best: { date: string; position: number } | null = null;
  let impWeightedPos = 0;
  let impSum = 0;
  for (const d of sorted) {
    if (d.impressions > 0) {
      impWeightedPos += d.position * d.impressions;
      impSum += d.impressions;
    }
    if (d.impressions > 0 && d.position > 0) {
      if (!best || d.position < best.position) {
        best = { date: d.date, position: d.position };
      }
    }
  }
  const lastDay = sorted[sorted.length - 1] ?? null;
  return {
    bestPositionDay: best,
    lastDay,
    periodAvgPosition: impSum > 0 ? impWeightedPos / impSum : null,
  };
}

const WIDTH = 520;
const HEIGHT = 160;
const PAD = { top: 24, right: 48, bottom: 28, left: 48 };

function scaleLinear(values: number[], minOut: number, maxOut: number): (v: number) => number {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  return (v: number) => minOut + ((v - min) / (max - min)) * (maxOut - minOut);
}

function polylinePoints(
  days: GscQueryDailyDay[],
  valueFn: (d: GscQueryDailyDay) => number,
  yScale: (v: number) => number,
  xAt: (i: number) => number,
): string {
  return days
    .map((d, i) => `${xAt(i).toFixed(1)},${yScale(valueFn(d)).toFixed(1)}`)
    .join(" ");
}

export function buildGscQuerySparklineSvg(query: string, days: GscQueryDailyDay[]): string {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><text x="24" y="80" fill="#888" font-family="Lato,sans-serif" font-size="14">No daily data</text></svg>`;
  }

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (sorted.length <= 1 ? plotW / 2 : (i / (sorted.length - 1)) * plotW);

  const imps = sorted.map((d) => d.impressions);
  const positions = sorted.map((d) => (d.position > 0 ? d.position : 0));
  const yImp = scaleLinear(imps, PAD.top + plotH, PAD.top);
  const yPos = scaleLinear(positions, PAD.top, PAD.top + plotH);

  const impLine = polylinePoints(sorted, (d) => d.impressions, yImp, xAt);
  const posLine = polylinePoints(sorted, (d) => (d.position > 0 ? d.position : positions[0] ?? 1), yPos, xAt);

  const title = query.length > 48 ? `${query.slice(0, 45)}…` : query;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Daily impressions and position for ${title}">
  <rect width="100%" height="100%" fill="#0a0a0a"/>
  <text x="${PAD.left}" y="16" fill="#e4e4e7" font-family="Lato,sans-serif" font-size="14" font-weight="600">${escapeXml(title)}</text>
  <text x="${WIDTH - PAD.right}" y="16" text-anchor="end" fill="#a78bfa" font-family="Lato,sans-serif" font-size="12">Imp</text>
  <text x="${WIDTH - PAD.right}" y="32" text-anchor="end" fill="#fb923c" font-family="Lato,sans-serif" font-size="12">Pos</text>
  <polyline fill="none" stroke="#a78bfa" stroke-width="2" points="${impLine}"/>
  <polyline fill="none" stroke="#fb923c" stroke-width="2" points="${posLine}"/>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Placeholder path embedded in report markdown; Drive upload rewrites to a public file URL. */
export function sparklineMarkdownImageRef(fileName: string, alt: string): string {
  return `![${alt}](sparkline:${fileName})`;
}
