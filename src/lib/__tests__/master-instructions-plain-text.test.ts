import { describe, it, expect } from "vitest";
import { plainTextToEditorHtml } from "../master-instructions-plain-text";
import { upsertMasterInstructionSource } from "../master-instructions-build-source";

describe("master instructions plain text helpers", () => {
  it("wraps paragraphs for the rich editor", () => {
    expect(plainTextToEditorHtml("line one\n\nline two")).toBe(
      "<p>line one</p><p>line two</p>",
    );
  });

  it("upserts by filename", () => {
    const first = {
      name: "master-rules-editor.txt",
      content: "a",
      uploadedAt: 1,
    };
    const second = {
      name: "master-rules-editor.txt",
      content: "b",
      uploadedAt: 2,
    };
    const out = upsertMasterInstructionSource([first], second);
    expect(out).toHaveLength(1);
    expect(out[0]?.content).toBe("b");
  });
});
