import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fillBlogRowKeywordFocusFromOpenRouter,
  validateDistilledFocusKeyword,
} from "@/lib/bulk/prompt-bulk-keyword-focus-agent";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

vi.mock("@/lib/openrouter-agent-category-api", () => ({
  callAgentCategoryOpenRouterChat: vi.fn(),
}));

describe("validateDistilledFocusKeyword", () => {
  it("accepts a 2–5 word product focus phrase", () => {
    expect(validateDistilledFocusKeyword("hunter douglas top down shades")).toBe(
      "hunter douglas top down shades",
    );
  });

  it("accepts 7-word Hunter Douglas product focus", () => {
    expect(
      validateDistilledFocusKeyword("hunter douglas top down bottom up shades"),
    ).toBe("hunter douglas top down bottom up shades");
  });

  it("rejects single-word focus", () => {
    expect(() => validateDistilledFocusKeyword("shades")).toThrow(/2–8 words/);
  });

  it("rejects blocklisted guide framing", () => {
    expect(() => validateDistilledFocusKeyword("buying guide")).toThrow(/blocklisted/);
  });
});

describe("fillBlogRowKeywordFocusFromOpenRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets keyword and keyword_focus from agent output", async () => {
    const { callAgentCategoryOpenRouterChat } = await import(
      "@/lib/openrouter-agent-category-api"
    );
    vi.mocked(callAgentCategoryOpenRouterChat).mockResolvedValue({
      content: JSON.stringify({
        focusKeywords: ["hunter douglas top down shades"],
      }),
      raw: {},
    });

    const rows: CSVRow[] = [
      {
        keyword:
          "A Complete Buying Guide To Hunter Douglas Top-Down Bottom-Up Shades In Canada",
        title:
          "A Complete Buying Guide To Hunter Douglas Top-Down Bottom-Up Shades In Canada",
      },
    ];

    const out = await fillBlogRowKeywordFocusFromOpenRouter(rows, {
      apiKey: "sk-test",
      topic: "Hunter Douglas shades Canada",
      strict: true,
    });

    expect(out[0]!.keyword_focus).toBe("hunter douglas top down shades");
    expect(out[0]!.keyword).toBe("hunter douglas top down shades");
  });

  it("preserves user-locked slot keyword but still sets keyword_focus", async () => {
    const { callAgentCategoryOpenRouterChat } = await import(
      "@/lib/openrouter-agent-category-api"
    );
    vi.mocked(callAgentCategoryOpenRouterChat).mockResolvedValue({
      content: JSON.stringify({
        focusKeywords: ["custom blinds edmonton"],
      }),
      raw: {},
    });

    const rows: CSVRow[] = [{ keyword: "user locked phrase", title: "Some Title Here" }];

    const out = await fillBlogRowKeywordFocusFromOpenRouter(rows, {
      apiKey: "sk-test",
      lockedSlotKeywords: [true],
      strict: true,
    });

    expect(out[0]!.keyword).toBe("user locked phrase");
    expect(out[0]!.keyword_focus).toBe("custom blinds edmonton");
  });

  it("throws when agent JSON is invalid", async () => {
    const { callAgentCategoryOpenRouterChat } = await import(
      "@/lib/openrouter-agent-category-api"
    );
    vi.mocked(callAgentCategoryOpenRouterChat).mockResolvedValue({
      content: "not json at all",
      raw: {},
    });

    await expect(
      fillBlogRowKeywordFocusFromOpenRouter(
        [{ keyword: "a", title: "Title With Enough Words" }],
        { apiKey: "sk-test", strict: true },
      ),
    ).rejects.toThrow();
  });
});
