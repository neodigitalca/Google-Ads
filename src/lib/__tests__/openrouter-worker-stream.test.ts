import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  openRouterWorkerChatCompletionUrlForTests,
  streamOpenRouterChatCompletionInWorker,
} from "@/lib/openrouter-worker-stream";

describe("openrouter worker stream", () => {
  beforeEach(() => {
    const encoder = new TextEncoder();
    const sse =
      'data: {"choices":[{"delta":{"content":"section"},"finish_reason":"stop"}]}\n\n';
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        body: {
          getReader() {
            let sent = false;
            return {
              read: async () => {
                if (sent) return { done: true, value: undefined };
                sent = true;
                return { done: false, value: encoder.encode(sse) };
              },
            };
          },
        },
      }) as unknown as Response),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to /api/openrouter/chat-completion with stream true", async () => {
    const result = await streamOpenRouterChatCompletionInWorker({
      apiKey: "test-key",
      model: "google/gemini-2.5-flash-lite",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.2,
      maxTokens: 16,
      topP: 1,
      onContentChunk: () => undefined,
    });

    expect(result.content).toBe("section");
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(url).toContain("/api/openrouter/chat-completion");
    expect(url).not.toContain("openrouter.ai");
    expect(body.stream).toBe(true);
    expect(init.headers instanceof Headers && init.headers.get("X-OpenRouter-Api-Key")).toBe(
      "test-key",
    );
  });

  it("fails fast when api key is empty", async () => {
    await expect(
      streamOpenRouterChatCompletionInWorker({
        apiKey: "",
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.2,
        maxTokens: 16,
        topP: 1,
        onContentChunk: () => undefined,
      }),
    ).rejects.toThrow(/API key is required/i);
  });

  it("uses same backend url helper as main thread", () => {
    expect(openRouterWorkerChatCompletionUrlForTests()).toContain("/api/openrouter/chat-completion");
  });
});
