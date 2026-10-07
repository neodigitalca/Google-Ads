import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { callAgentCategoryOpenRouterChat } from "@/lib/openrouter-agent-category-api";
import {
  isBlocklistedPrimaryKeyword,
  isCompanyNameKeyword,
} from "@/lib/gsc-simple-keyword-recommendation";
import { parseJsonObjectFromModelText } from "@/lib/openrouter-vision-chat";

const FOCUS_FILL_CHUNK = 10;
/** Product + brand intent phrases (e.g. Hunter Douglas top down bottom up shades) can need 7–8 words. */
const FOCUS_KEYWORD_MIN_WORDS = 2;
const FOCUS_KEYWORD_MAX_WORDS = 8;

const KEYWORD_FOCUS_AGENT_SYSTEM = `You distill short SEO focus keywords for national blog posts from a general topic, title, and draft keyword.

Output ONLY valid JSON: {"focusKeywords":["..."]} with exactly one focus keyword per input row in rows[], same order.

Rules for each focusKeyword:
- ${FOCUS_KEYWORD_MIN_WORDS} to 6 words when possible; hard max ${FOCUS_KEYWORD_MAX_WORDS}. Intent-only primary SEO / ACF focus phrase.
- Product and brand names that appear in the title (e.g. Hunter Douglas, top down bottom up shades) may appear when they define search intent. Keep the full product name even if that uses 7–8 words.
- Do NOT repeat the full headline. Strip listicle or guide framing (buying guide, complete guide, how to, ultimate guide).
- Do NOT include the site or business name as the keyword.
- Do NOT include country, state, or city names when origin/geo is handled elsewhere (e.g. drop trailing "in Canada" from the keyword).
- Lowercase is fine. Spaces only between words. No quotes inside the keyword string.
- Vary wording across rows when titles differ.`;

type FocusAgentResponse = {
  focusKeywords?: unknown;
};

function normalizeFocusPhrase(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 500);
}

function wordCount(phrase: string): number {
  return phrase.split(/\s+/).filter(Boolean).length;
}

export function validateDistilledFocusKeyword(
  focus: string,
  siteName?: string,
): string {
  const kw = normalizeFocusPhrase(focus);
  if (!kw) {
    throw new Error("Keyword focus agent returned an empty focus keyword.");
  }
  const words = wordCount(kw);
  if (words < FOCUS_KEYWORD_MIN_WORDS || words > FOCUS_KEYWORD_MAX_WORDS) {
    throw new Error(
      `Keyword focus must be ${FOCUS_KEYWORD_MIN_WORDS}–${FOCUS_KEYWORD_MAX_WORDS} words (got ${words}): "${kw.slice(0, 80)}"`,
    );
  }
  if (isBlocklistedPrimaryKeyword(kw)) {
    throw new Error(`Keyword focus is blocklisted: "${kw.slice(0, 80)}"`);
  }
  if (isCompanyNameKeyword(kw, siteName)) {
    throw new Error(`Keyword focus must not be the site name: "${kw.slice(0, 80)}"`);
  }
  return kw;
}

function focusKeywordsFromModelContent(raw: string): string[] {
  const parsed = parseJsonObjectFromModelText(raw) as FocusAgentResponse;
  if (!Array.isArray(parsed.focusKeywords)) {
    throw new Error("Keyword focus agent JSON missing focusKeywords array.");
  }
  return parsed.focusKeywords.map((k) => String(k ?? "").trim());
}

function buildFocusFillPayload(
  rows: CSVRow[],
  topic: string,
): { topic: string; title: string; keyword: string; entity: string }[] {
  const topicTrim = topic.trim();
  return rows.map((row) => ({
    topic: topicTrim,
    title: (row.title ?? "").trim(),
    keyword: (row.keyword ?? "").trim(),
    entity: (row.entity ?? "").trim(),
  }));
}

async function fetchFocusKeywordsBatch(
  apiKey: string,
  siteId: string | undefined,
  topic: string,
  rows: CSVRow[],
  siteName: string,
): Promise<string[]> {
  if (rows.length === 0) return [];

  const { content } = await callAgentCategoryOpenRouterChat({
    category: "meta",
    siteId,
    apiKey,
    system: KEYWORD_FOCUS_AGENT_SYSTEM,
    user: JSON.stringify({ rows: buildFocusFillPayload(rows, topic) }),
    temperature: 0,
    maxTokens: Math.max(512, rows.length * 64),
    responseFormat: { type: "json_object" },
  });

  const rawList = focusKeywordsFromModelContent(content);

  if (rawList.length !== rows.length) {
    throw new Error(
      `Keyword focus agent returned ${rawList.length}/${rows.length} keywords.`,
    );
  }

  return rawList.map((k) => validateDistilledFocusKeyword(k, siteName));
}

export type FillBlogRowKeywordFocusOptions = {
  apiKey: string;
  siteId?: string;
  siteName?: string;
  /** General topic / flowPurpose passed into the ideas step. */
  topic?: string;
  /** Parallel to rows: when true, do not overwrite row.keyword (user-locked slot). */
  lockedSlotKeywords?: boolean[];
  strict?: boolean;
  onProgress?: (done: number, total: number) => void;
};

/** Distill ACF-style focus keywords before meta/slug agents (Prompt Ideas path). */
export async function fillBlogRowKeywordFocusFromOpenRouter(
  rows: CSVRow[],
  options: FillBlogRowKeywordFocusOptions,
): Promise<CSVRow[]> {
  if (rows.length === 0) return rows;
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is required for keyword focus distillation.");
  }
  const topic = (options.topic ?? "").trim();
  const siteName = (options.siteName ?? "").trim();
  const out = rows.map((r) => ({ ...r }));
  const total = out.length;
  const locked = options.lockedSlotKeywords ?? [];

  const pendingIndices = out.map((_, index) => index);

  const chunkStarts: number[] = [];
  for (let chunkStart = 0; chunkStart < pendingIndices.length; chunkStart += FOCUS_FILL_CHUNK) {
    chunkStarts.push(chunkStart);
  }

  for (const chunkStart of chunkStarts) {
    const chunkIndices = pendingIndices.slice(chunkStart, chunkStart + FOCUS_FILL_CHUNK);
    const chunkRows = chunkIndices.map((i) => out[i]!);
    try {
      const focusList = await fetchFocusKeywordsBatch(
        apiKey,
        options.siteId,
        topic,
        chunkRows,
        siteName,
      );
      chunkIndices.forEach((idx, i) => {
        const focus = focusList[i]!;
        const userLocked = locked[idx] === true;
        out[idx] = {
          ...out[idx]!,
          keyword_focus: focus,
          keyword: userLocked ? out[idx]!.keyword : focus,
        };
      });
    } catch (err) {
      if (options.strict !== false) {
        throw err instanceof Error ? err : new Error(String(err));
      }
    }
    options.onProgress?.(
      out.filter((r) => (r.keyword_focus ?? "").trim().length > 0).length,
      total,
    );
  }

  const missing = out.find((r) => !(r.keyword_focus ?? "").trim());
  if (missing && options.strict !== false) {
    throw new Error("Keyword focus agent did not return a focus keyword for every idea row.");
  }

  return out;
}
