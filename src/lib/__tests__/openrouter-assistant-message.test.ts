import { describe, expect, it } from "vitest";
import { openRouterAssistantTextFromMessage } from "@/lib/openrouter-app-api";

describe("openRouterAssistantTextFromMessage", () => {
  it("uses string content when present", () => {
    expect(openRouterAssistantTextFromMessage({ content: " hello " })).toBe("hello");
  });

  it("falls back to reasoning when content is empty", () => {
    expect(
      openRouterAssistantTextFromMessage({
        content: "",
        reasoning: '{"keywords":["solar panels"]}',
      }),
    ).toBe('{"keywords":["solar panels"]}');
  });

  it("joins reasoning_details text parts", () => {
    expect(
      openRouterAssistantTextFromMessage({
        content: "",
        reasoning_details: [{ text: "line one" }, { text: "line two" }],
      }),
    ).toBe("line one\nline two");
  });
});
