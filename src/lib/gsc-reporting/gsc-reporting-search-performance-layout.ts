/** Strip model output that uses one keyword per heading with inline Clk/Imp bullets. */
export function stripPerQueryKeywordBlocks(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();
    const isMetricBullet = /^-\s*(?:\*\*)?(?:Clk|Imp|Pos|CTR)\b/i.test(trimmed);
    const isQueryTitle =
      trimmed.length > 0 &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("|") &&
      !trimmed.startsWith("#") &&
      !trimmed.startsWith("_") &&
      i + 1 < lines.length &&
      /^-\s*(?:\*\*)?(?:Clk|Imp|Pos|CTR)\b/i.test(lines[i + 1]!.trim());

    if (isQueryTitle) {
      i += 1;
      while (i < lines.length && /^-\s*(?:\*\*)?(?:Clk|Imp|Pos|CTR)\b/i.test(lines[i]!.trim())) {
        i += 1;
      }
      while (i < lines.length && lines[i]!.trim() !== "" && !lines[i]!.trim().startsWith("-")) {
        i += 1;
      }
      continue;
    }
    if (isMetricBullet) {
      i += 1;
      continue;
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isInsightBullet(line: string): boolean {
  return /^[-*]\s+\*\*[^*]+:\*\*/.test(line.trim());
}

/** Intro prose first, then injected tables, then optional insight bullets. */
export function assembleSearchPerformanceSectionBody(args: {
  modelBody: string;
  injectedTables: string;
  /** Period-progress Search Performance: paragraph + tables only. */
  includeInsightBullets?: boolean;
}): string {
  const includeInsightBullets = args.includeInsightBullets !== false;
  const cleaned = stripPerQueryKeywordBlocks(args.modelBody);
  const lines = cleaned.split("\n");
  const intro: string[] = [];
  const bullets: string[] = [];
  for (const line of lines) {
    if (isInsightBullet(line)) {
      bullets.push(line);
    } else if (line.trim() === "" && intro.length === 0 && bullets.length === 0) {
      continue;
    } else if (bullets.length === 0 && !isInsightBullet(line)) {
      intro.push(line);
    }
  }
  const introText = intro.join("\n").trim();
  const bulletText = includeInsightBullets ? bullets.join("\n").trim() : "";
  const tables = args.injectedTables.trim();
  return [introText, tables, bulletText].filter((p) => p.length > 0).join("\n\n");
}
