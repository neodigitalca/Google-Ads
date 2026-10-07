import type { CSVRow } from "@/lib/bulk-auto-generate";
import { postOpenRouterAppChat } from "@/lib/openrouter-app-api";

const SYSTEM = `You draft blog post ideas for human approval. No research, SERP, or inventory. Only keyword and title per idea (meta descriptions are written separately).

Rules:
- Return exactly the requested count.
- keyword: short SEO focus phrase (2–5 words), not the full headline or guide title.
- title: complete headline, Title Case, readable and specific.
- When a topic is given, every idea must fit that topic.
- When a slot already has a keyword, keep that keyword and write a title for it.`;

function ideasResponseFormat(count: number) {
  const n = Math.max(1, Math.min(50, Math.floor(count) || 1));
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "prompt_bulk_blog_ideas",
      strict: false,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ideas"],
        properties: {
          ideas: {
            type: "array",
            minItems: n,
            maxItems: n,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["keyword", "title"],
              properties: {
                keyword: { type: "string", minLength: 1 },
                title: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },
  };
}

type IdeasPayload = {
  ideas?: Array<{
    keyword?: unknown;
    title?: unknown;
  }>;
};

function cleanField(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function generateSimplePromptIdeas(args: {
  apiKey: string;
  model: string;
  count: number;
  topic?: string;
  modifier?: string;
  slotKeywords?: string[];
  slotModifiers?: string[];
  temperature?: number;
  maxTokens?: number;
}): Promise<CSVRow[]> {
  const count = Math.max(1, Math.min(50, Math.floor(args.count) || 1));
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is required.");
  }

  const slots = Array.from({ length: count }, (_, i) => ({
    keyword: args.slotKeywords?.[i]?.trim() || "",
    modifier: args.slotModifiers?.[i]?.trim() || "",
  }));

  const user = JSON.stringify({
    count,
    topic: args.topic?.trim() || "",
    modifier: args.modifier?.trim() || "",
    slots,
  });

  const { content, parsed } = await postOpenRouterAppChat({
    apiKey,
    model: args.model,
    system: SYSTEM,
    user,
    temperature: args.temperature ?? 0.6,
    maxTokens: args.maxTokens ?? Math.max(1024, count * 400),
    responseFormat: ideasResponseFormat(count),
  });

  let payload: IdeasPayload;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    payload = parsed as IdeasPayload;
  } else {
    try {
      payload = JSON.parse(content.trim()) as IdeasPayload;
    } catch {
      throw new Error(`Ideas agent returned invalid JSON. Start: ${content.slice(0, 240)}`);
    }
  }

  const rawIdeas = Array.isArray(payload.ideas) ? payload.ideas : [];
  if (rawIdeas.length !== count) {
    throw new Error(`Ideas agent returned ${rawIdeas.length}/${count} rows.`);
  }

  const rows: CSVRow[] = [];
  for (let i = 0; i < count; i++) {
    const item = rawIdeas[i] ?? {};
    const slotKw = slots[i]?.keyword ?? "";
    const keyword = slotKw || cleanField(item.keyword);
    const title = cleanField(item.title);
    if (!keyword || !title) {
      throw new Error(`Ideas row ${i + 1} is missing keyword or title.`);
    }
    const row: CSVRow = { keyword, title };
    const mod = slots[i]?.modifier;
    if (mod) row.modifier = mod;
    rows.push(row);
  }
  return rows;
}
