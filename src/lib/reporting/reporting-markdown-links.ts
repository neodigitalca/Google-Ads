/** Short page label from URL path (for `[label](url)` in client reports). */
export function humanPageLinkLabelFromUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return "Home";
    let slug = parts[parts.length - 1]!;
    if (/^(index|page)$/i.test(slug) && parts.length > 1) {
      slug = parts[parts.length - 2]!;
    }
    const words = slug.split("-").filter(Boolean);
    if (words.length === 0) return "Page";
    const minor = new Set(["vs", "and", "or", "to"]);
    return words
      .map((w, i) => {
        const lower = w.toLowerCase();
        if (i > 0 && minor.has(lower)) return lower;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");
  } catch {
    return "Page";
  }
}

function trimTrailingUrlPunctuation(raw: string): { href: string; suffix: string } {
  let href = raw;
  let suffix = "";
  while (/[.,;:!?]$/.test(href)) {
    suffix = href.slice(-1) + suffix;
    href = href.slice(0, -1);
  }
  return { href, suffix };
}

function urlToMarkdownLink(rawUrl: string): string {
  const { href, suffix } = trimTrailingUrlPunctuation(rawUrl);
  const label = humanPageLinkLabelFromUrl(href);
  return `[${label}](${href})${suffix}`;
}

const BACKTICK_MD_LINK = /`(\[[^\]|`\n]+\]\((https?:\/\/[^)\s`]+)\))`/g;
const BACKTICK_URL = /`(https?:\/\/[^\s`]+)`/g;
const BOLD_BARE_URL = /\*\*(https?:\/\/[^\s*]+)\*\*/g;
const BARE_URL = /(?<!\]\()(?<!\()(https?:\/\/[^\s)\]`<>]+)/g;

/** One line: unwrap backticks; replace naked URLs with markdown anchors. */
export function normalizeReportingMarkdownLinksInLine(line: string): string {
  let s = line.replace(BACKTICK_MD_LINK, "$1");
  s = s.replace(BACKTICK_URL, (_m, url: string) => urlToMarkdownLink(url));
  s = s.replace(BOLD_BARE_URL, (_m, url: string) => urlToMarkdownLink(url));
  s = s.replace(BARE_URL, (match) => urlToMarkdownLink(match));
  return s;
}

/** Full markdown body (skips fenced code blocks). */
export function normalizeReportingMarkdownLinks(md: string): string {
  const lines = md.split("\n");
  let inFence = false;
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    out.push(normalizeReportingMarkdownLinksInLine(line));
  }
  return out.join("\n");
}
