import { describe, expect, it } from "vitest";
import { parseImageEvidenceNeeds } from "@/lib/image-reference-research";
import {
  IMAGE_SCENE_PLAUSIBILITY_CHECKLIST_TITLE,
  IMAGE_SCENE_PLAUSIBILITY_PROMPT,
  hasPhysicalScenePlausibilityItem,
} from "@/lib/image-scene-plausibility";
import { parseImageChecklist } from "@/lib/image-checklist-builder";
import { buildImagePrompt } from "@/lib/image-prompt-builder";

describe("parseImageChecklist strictFeatured", () => {
  const validFeatured = `Physical scene plausibility

I'm currently ensuring blinds appear inside a window frame with glazing, not on bare drywall.

Subject and theme

I'm now focusing on the main service topic from the article with a realistic interior.

Composition and lighting

I'm currently planning soft daylight through the window slats for a believable residential scene.`;

  it("parses valid featured checklist with plausibility item", () => {
    const items = parseImageChecklist(validFeatured, { strictFeatured: true });
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(hasPhysicalScenePlausibilityItem(items)).toBe(true);
  });

  it("adds plausibility item when featured checklist omits it", () => {
    const body = `Theme focus

I'm currently describing the blog theme only.

Layout

I'm now planning a wide composition.`;
    const items = parseImageChecklist(body, { strictFeatured: true });
    expect(hasPhysicalScenePlausibilityItem(items)).toBe(true);
  });

  it("returns plausibility item on empty response", () => {
    const items = parseImageChecklist("", { strictFeatured: true });
    expect(items.some((i) => i.title === IMAGE_SCENE_PLAUSIBILITY_CHECKLIST_TITLE)).toBe(
      true,
    );
  });
});

describe("featured evidence plan parse", () => {
  it("parses grounded blinds plan with window context query", () => {
    const plan = parseImageEvidenceNeeds({
      mode: "grounded",
      needs: [
        {
          kind: "howto",
          layer: "midground",
          query: "white window blinds installed in window frame living room",
          role: "install",
          location_name: "United States",
          acceptanceBrief:
            "Must show blinds in a window with frame and glazing, not on bare wall.",
          pickCount: 1,
        },
      ],
    });
    expect(plan.mode).toBe("grounded");
    expect(plan.needs[0]?.query.toLowerCase()).toContain("window");
  });
});

describe("buildImagePrompt featured scene block", () => {
  it("includes scene plausibility for featured context", () => {
    const prompt = buildImagePrompt(
      {
        flowTitle: "Blind repair",
        flowPurpose: "Help homeowners",
        finalOutput: "Guide to fixing window blinds.",
      },
      {
        includeText: false,
        includePeople: false,
        includeAnimals: false,
        includeCars: false,
        isInfographic: false,
        aspectRatio: "16:9",
        style: "professional",
        colorScheme: "vibrant",
      },
    );
    expect(prompt).toContain(IMAGE_SCENE_PLAUSIBILITY_PROMPT.slice(0, 40));
  });
});
