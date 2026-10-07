import { describe, expect, it } from "vitest";
import {
  detectHarnessHtmlMarkdownLeaks,
  repairHarnessHtmlMarkdownLeaks,
} from "../harness-html-quality-control";

describe("harness-html-quality-control", () => {
  it("detects asterisk bold in HTML", () => {
    const html = "<ul><li>**Extreme Temperature Variations**: Cold drafts.</li></ul>";
    expect(detectHarnessHtmlMarkdownLeaks(html)).toContain("asterisk_bold");
  });

  it("repairs labeled list markdown bold in li", () => {
    const html =
      "<h2>Factors</h2><ul><li>**Extreme Temperature Variations**: Honeycomb cells help.</li><li>**Cord Safety Regulations**: Use cordless options.</li></ul>";
    const out = repairHarnessHtmlMarkdownLeaks(html);
    expect(out).toContain("<strong>Extreme Temperature Variations</strong>:");
    expect(out).toContain("<strong>Cord Safety Regulations</strong>:");
    expect(out).not.toContain("**");
    expect(detectHarnessHtmlMarkdownLeaks(out)).toEqual([]);
  });

  it("leaves clean HTML unchanged", () => {
    const html =
      "<h2>Coverage</h2><table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>";
    expect(repairHarnessHtmlMarkdownLeaks(html)).toBe(html);
    expect(detectHarnessHtmlMarkdownLeaks(html)).toEqual([]);
  });

  it("repairs **bold** inside paragraphs", () => {
    const html = "<p>See **Important Note**: always measure twice.</p>";
    const out = repairHarnessHtmlMarkdownLeaks(html);
    expect(out).toContain("<strong>Important Note</strong>:");
    expect(detectHarnessHtmlMarkdownLeaks(out)).toEqual([]);
  });
});
