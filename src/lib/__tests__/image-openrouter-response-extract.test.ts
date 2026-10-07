import { describe, expect, it } from "vitest";
import { extractImageFromOpenRouterAssistantMessage } from "@/lib/image-openrouter-response-extract";

describe("extractImageFromOpenRouterAssistantMessage", () => {
  it("reads OpenRouter images[] with nested image_url.url", () => {
    const out = extractImageFromOpenRouterAssistantMessage({
      role: "assistant",
      content: null,
      images: [
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,abc123" },
        },
      ],
    });
    expect(out?.imageBase64).toBe("data:image/png;base64,abc123");
  });

  it("reads image parts from content array", () => {
    const out = extractImageFromOpenRouterAssistantMessage({
      content: [
        { type: "image_url", image_url: { url: "https://cdn.example.com/a.png" } },
      ],
    });
    expect(out?.imageUrl).toBe("https://cdn.example.com/a.png");
  });
});
