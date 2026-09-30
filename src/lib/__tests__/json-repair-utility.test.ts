import { describe, expect, it } from "vitest";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";

describe("parseJsonWithRepair fail-open", () => {
  it("returns full raw text without throwing when storeRaw is set", () => {
    const malformed = '{"items":["unterminated string';
    const result = parseJsonWithRepair(malformed, { onParseFailure: "storeRaw" });
    expect(result.parsed).toBeNull();
    expect(result.rawText).toBe(malformed);
    expect(result.parseError).toBeTruthy();
  });

  it("parses valid JSON without repair", () => {
    const result = parseJsonWithRepair('{"ok":true}');
    expect(result.parsed).toEqual({ ok: true });
    expect(result.usedRepair).toBe(false);
  });
});
