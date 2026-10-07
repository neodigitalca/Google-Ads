import { describe, expect, it } from "vitest";
import { buildOpenRouterAppChatRequestBody, openRouterPromptText } from "@/lib/openrouter-app-api";

describe("openRouterPromptText", () => {
  it("coerces non-string values without throwing", () => {
    expect(openRouterPromptText({ role: "system" })).toBe("[object Object]");
    expect(openRouterPromptText(42)).toBe("42");
  });
});

describe("buildOpenRouterAppChatRequestBody", () => {
  it("uses system and user when messages are omitted", () => {
    const body = buildOpenRouterAppChatRequestBody({
      model: "test/model",
      system: "sys",
      user: "usr",
      maxTokens: 100,
    });
    expect(body.system).toBe("sys");
    expect(body.user).toBe("usr");
    expect(body.messages).toBeUndefined();
  });

  it("prefers non-empty messages over empty system/user", () => {
    const body = buildOpenRouterAppChatRequestBody({
      model: "test/model",
      messages: [{ role: "user", content: "hello" }],
      system: "",
      user: "",
    });
    expect(body.messages).toEqual([{ role: "user", content: "hello" }]);
    expect(body.system).toBeUndefined();
  });

  it("throws when there is no message content", () => {
    expect(() =>
      buildOpenRouterAppChatRequestBody({
        model: "test/model",
        messages: [{ role: "user", content: "   " }],
        system: "",
        user: "",
      }),
    ).toThrow(/no message content/i);
  });
});
