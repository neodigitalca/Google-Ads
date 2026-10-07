import { describe, expect, it } from "vitest";
import { parseImageGroundingClassification } from "@/lib/image-reference-research";

describe("image grounding classification parse", () => {
  it("accepts strict-schema shaped Hunter Douglas product payload", () => {
    const parsed = parseImageGroundingClassification({
      mode: "grounded",
      targets: [
        {
          kind: "product",
          layer: "foreground",
          query: "Hunter Douglas top-down bottom-up shades",
          role: "product identity",
          location_name: "Canada",
        },
      ],
    });
    expect(parsed.mode).toBe("grounded");
    expect(parsed.targets).toHaveLength(1);
    expect(parsed.targets[0]?.location_name).toBe("Canada");
  });

  it("returns abstract when mode is abstract", () => {
    const parsed = parseImageGroundingClassification({ mode: "abstract", targets: [] });
    expect(parsed).toEqual({ mode: "abstract", targets: [] });
  });
});
