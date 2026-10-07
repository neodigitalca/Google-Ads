import { describe, expect, it } from "vitest";
import {
  isWindowTreatmentImageContext,
  windowTreatmentImagePromptSuffix,
  WINDOW_TREATMENT_IMAGE_PROMPT_RULES,
} from "@/lib/image-window-treatment-prompt-rules";

describe("windowTreatmentImagePromptSuffix", () => {
  it("detects parts-of-a-blind blog topics", () => {
    expect(
      isWindowTreatmentImageContext(
        "Understanding The Parts Of A Blind And Its Components",
        "parts of a blind",
      ),
    ).toBe(true);
  });

  it("returns empty for unrelated topics", () => {
    expect(windowTreatmentImagePromptSuffix("CRA mail policy", "tax forms")).toBe("");
  });

  it("includes Canada cord and parts rules for blind topics", () => {
    const suffix = windowTreatmentImagePromptSuffix(
      "Anatomy Of A Blind Understanding The Components",
    );
    expect(suffix).toContain(WINDOW_TREATMENT_IMAGE_PROMPT_RULES.slice(0, 30));
    expect(suffix.toLowerCase()).toContain("canada");
    expect(suffix.toLowerCase()).toContain("battery");
    expect(suffix.toLowerCase()).toContain("hunter douglas");
    expect(suffix.toLowerCase()).toContain("exposed");
  });
});
