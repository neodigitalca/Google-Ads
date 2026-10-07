import { ensureHarnessListItemBoldLabels } from "@/lib/overview/overview-bullet-bold-labels";
import { postOpenRouterAppChat } from "@/lib/openrouter-app-api";

const BOLD_MARKDOWN_RE = /\*\*[^*]+\*\*/;
const MARKDOWN_H2_LINE_RE = /(?:^|\n)##\s+/m;
const P_MARKDOWN_BULLET_RE = /<p[^>]*>[\s\S]*?-\s+\*\*[^*]+\*\*/i;

export type HarnessHtmlMarkdownLeakKind =
  | "asterisk_bold"
  | "markdown_h2_line"
  | "paragraph_markdown_bullet";

export function detectHarnessHtmlMarkdownLeaks(html: string): HarnessHtmlMarkdownLeakKind[] {
  const src = html ?? "";
  if (!src.trim()) return [];
  const leaks: HarnessHtmlMarkdownLeakKind[] = [];
  if (BOLD_MARKDOWN_RE.test(src)) leaks.push("asterisk_bold");
  if (MARKDOWN_H2_LINE_RE.test(src)) leaks.push("markdown_h2_line");
  if (P_MARKDOWN_BULLET_RE.test(src)) leaks.push("paragraph_markdown_bullet");
  return leaks;
}

function convertMarkdownBoldSpansInText(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** Repair **bold** inside each <p>...</p> inner HTML (preserve tags and placeholders). */
function repairMarkdownBoldInParagraphs(html: string): string {
  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (_full, attrs, inner) => {
    if (!BOLD_MARKDOWN_RE.test(inner)) return _full;
    return `<p${attrs}>${convertMarkdownBoldSpansInText(inner)}</p>`;
  });
}

export function repairHarnessHtmlMarkdownLeaks(html: string): string {
  const src = html ?? "";
  if (!src.trim()) return src;
  let out = ensureHarnessListItemBoldLabels(src);
  out = repairMarkdownBoldInParagraphs(out);
  if (BOLD_MARKDOWN_RE.test(out)) {
    out = convertMarkdownBoldSpansInText(out);
  }
  return out;
}

function stripHtmlCodeFence(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/^```(?:html)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fence) s = fence[1]!.trim();
  return s;
}

const QC_SYSTEM_PROMPT = `Quality control — HTML format only.
You receive harness blog HTML that still contains markdown leaks.
Fix formatting only: convert **bold** to <strong>, markdown ## headings to <h2>/<h3>, and markdown - bullets in paragraphs to proper <ul><li> with <strong>Label</strong>: when labeled.
Do not change wording, facts, link URLs, link anchor text, heading text, or section order.
Return the full corrected HTML only. No preamble, no code fences.`;

async function openRouterFormatFix(args: {
  html: string;
  leaks: HarnessHtmlMarkdownLeakKind[];
  apiKey: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const leakList = args.leaks.join(", ");
  const { content } = await postOpenRouterAppChat({
    apiKey: args.apiKey,
    model: args.model,
    messages: [
      { role: "system", content: QC_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Markdown leaks detected: ${leakList}\n\nFix this HTML:\n\n${args.html}`,
      },
    ],
    temperature: 0.1,
    maxTokens: 16000,
    signal: args.signal,
  });
  const fixed = stripHtmlCodeFence(content);
  if (!fixed.trim()) {
    throw new Error("Harness HTML quality control: OpenRouter returned empty HTML");
  }
  return fixed;
}

export type RunHarnessHtmlQualityControlArgs = {
  html: string;
  apiKey?: string;
  model?: string;
  signal?: AbortSignal;
};

/**
 * Quality control: deterministic markdown leak repair, optional one OpenRouter format pass, then fail if leaks remain.
 */
export async function runHarnessHtmlQualityControl(
  args: RunHarnessHtmlQualityControlArgs,
): Promise<string> {
  const initial = (args.html ?? "").trim();
  if (!initial) {
    throw new Error("Harness HTML quality control: empty HTML");
  }

  let html = repairHarnessHtmlMarkdownLeaks(initial);
  let leaks = detectHarnessHtmlMarkdownLeaks(html);
  if (leaks.length === 0) return html;

  const key = args.apiKey?.trim();
  if (key) {
    html = repairHarnessHtmlMarkdownLeaks(
      await openRouterFormatFix({ html, leaks, apiKey: key, model: args.model, signal: args.signal }),
    );
    leaks = detectHarnessHtmlMarkdownLeaks(html);
  }

  if (leaks.length > 0) {
    throw new Error(
      `Harness HTML quality control failed: markdown leaks remain (${leaks.join(", ")}). Fix list labels to use <strong>Label</strong>: not **Label**:.`,
    );
  }
  return html;
}
