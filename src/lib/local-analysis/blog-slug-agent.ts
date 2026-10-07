import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { getCompetitorReportMaxOutputTokens } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { openRouterWebAppHeaders } from "@/lib/openrouter-attribution";
import { postOpenRouterAppChatFetch } from "@/lib/openrouter-app-api";
import { sanitizeWordPressSlugSegment } from "@/lib/rank-math-redirect-csv";
import {
  appendMasterInstructionsToSystemPrompt,
  buildSapMasterRulesWorkflowPrefix,
  ensureMasterInstructionsInMemory,
} from "@/lib/master-instructions-storage";

const SLUG_FILL_CHUNK = 10;

const BLOG_SLUG_AGENT_SYSTEM = `You are a URL slug agent for national blog posts.

Output **only** valid JSON: {"slugs":["..."]} with **exactly one** slug per input row in \`rows[]\`, same order.

Each row has \`title\` and \`keyword\`. \`entity\` may be empty.

**Slug rules (mandatory):**
- Lowercase, hyphen-separated \`[a-z0-9-]\` only. Every word token must be separated by hyphens.
- **Forbidden:** concatenating words into one token (e.g. hunterdouglastopdown), copying the full title verbatim, leading/trailing hyphens.
- As short as reasonable while keeping search intent from the keyword. Drop glue words (the, for, and, a).
- Include the core keyword phrase; you may shorten brand/product names only when the hyphenated form stays readable.
- Max 80 characters. No file extension, no path, no domain.`;

type SlugAgentResponse = {
  slugs?: unknown;
};

function slugsFromOpenRouterContent(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as SlugAgentResponse;
    if (!Array.isArray(parsed.slugs)) return [];
    return parsed.slugs.map((s) => sanitizeWordPressSlugSegment(String(s ?? "")));
  } catch {
    return [];
  }
}

async function fetchSlugsBatch(
  apiKey: string,
  model: string,
  siteId: string | undefined,
  rows: CSVRow[],
): Promise<string[]> {
  if (rows.length === 0) return [];
  await ensureMasterInstructionsInMemory(siteId);
  const payload = rows.map((row) => ({
    title: (row.title ?? "").trim(),
    keyword: (row.keyword ?? "").trim(),
    entity: (row.entity ?? "").trim(),
  }));
  const systemForModel = appendMasterInstructionsToSystemPrompt(
    `${buildSapMasterRulesWorkflowPrefix(siteId ?? null)}${BLOG_SLUG_AGENT_SYSTEM}`,
    siteId ?? null,
  );

  const response = await postOpenRouterAppChatFetch({
    method: "POST",
    headers: openRouterWebAppHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemForModel },
        { role: "user", content: JSON.stringify({ rows: payload }) },
      ],
      temperature: 0.2,
      max_tokens: getCompetitorReportMaxOutputTokens(model),
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `URL slug agent failed (${response.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const slugs = slugsFromOpenRouterContent(raw);
  if (slugs.length < rows.length) {
    throw new Error(
      `URL slug agent returned ${slugs.length}/${rows.length} slugs.`,
    );
  }
  for (let i = 0; i < rows.length; i++) {
    const slug = slugs[i] ?? "";
    if (slug.length < 2) {
      throw new Error(`URL slug agent returned an empty slug for row ${i + 1}.`);
    }
    if (!slug.includes("-") && (rows[i]?.keyword ?? "").trim().includes(" ")) {
      throw new Error(
        `URL slug agent returned a non-hyphenated slug for row ${i + 1}. Regenerate Ideas.`,
      );
    }
  }
  return slugs.slice(0, rows.length);
}

export type FillBlogRowSlugOptions = {
  apiKey: string;
  model: string;
  siteId?: string;
  onProgress?: (done: number, total: number) => void;
};

/** One OpenRouter pass per chunk: blog post URL slugs from title + keyword. */
export async function fillBlogRowSlugFromOpenRouter(
  rows: CSVRow[],
  options: FillBlogRowSlugOptions,
): Promise<CSVRow[]> {
  if (rows.length === 0) return rows;
  const apiKey = options.apiKey.trim();
  const model = options.model.trim();
  const out = rows.map((r) => ({ ...r, target_slug: undefined as string | undefined }));
  const total = out.length;

  const chunkStarts: number[] = [];
  for (let chunkStart = 0; chunkStart < total; chunkStart += SLUG_FILL_CHUNK) {
    chunkStarts.push(chunkStart);
  }

  await Promise.all(
    chunkStarts.map(async (chunkStart) => {
      const chunkIndices = Array.from(
        { length: Math.min(SLUG_FILL_CHUNK, total - chunkStart) },
        (_, j) => chunkStart + j,
      );
      const chunkRows = chunkIndices.map((i) => out[i]!);
      const slugs = await fetchSlugsBatch(apiKey, model, options.siteId, chunkRows);
      for (let i = 0; i < chunkIndices.length; i++) {
        const idx = chunkIndices[i]!;
        out[idx] = { ...out[idx]!, target_slug: slugs[i] };
      }
      options.onProgress?.(
        out.filter((r) => (r.target_slug ?? "").trim().length >= 2).length,
        total,
      );
    }),
  );

  return out;
}
