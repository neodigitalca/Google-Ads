import { describe, expect, it } from "vitest";
import {
  propertyNameMatchesReportingShortcutClient,
  propertyShowsReportingShortcut,
} from "@/lib/wordpress-property-profile-tags";
import type { WordPressSite } from "@/components/integrations/types";

describe("propertyShowsReportingShortcut", () => {
  it("matches You Junk It property display name", () => {
    expect(
      propertyNameMatchesReportingShortcutClient("You Junk It... I Dump It", "You Junk It"),
    ).toBe(true);
  });

  it("matches Shutter Spot as Blind Spot reporting client", () => {
    expect(propertyNameMatchesReportingShortcutClient("Shutter Spot", "Blind Spot")).toBe(true);
    expect(
      propertyShowsReportingShortcut({ name: "Shutter Spot" } as WordPressSite),
    ).toBe(true);
  });

  it("does not show reporting shortcut for Advance Blinds", () => {
    expect(
      propertyShowsReportingShortcut({ name: "Advance Blinds" } as WordPressSite),
    ).toBe(false);
  });
});
