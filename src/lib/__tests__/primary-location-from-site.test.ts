import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { resolveEntityClusterLocationLabel } from "@/lib/primary-location-from-site";

describe("resolveEntityClusterLocationLabel", () => {
  it("prefers the Location field over Integrations", () => {
    const site = {
      id: "1",
      name: "Test",
      siteUrl: "https://example.com",
      username: "",
      appPassword: "",
      connectedAt: 0,
      napInfo: { address: "Calgary, AB" },
    } satisfies WordPressSite;
    expect(resolveEntityClusterLocationLabel(site, "Winkler, MB")).toBe("Winkler, MB");
  });

  it("uses NAP address when Location is empty and locations have no city", () => {
    const site = {
      id: "1",
      name: "Test",
      siteUrl: "https://example.com",
      username: "",
      appPassword: "",
      connectedAt: 0,
      napInfo: { address: "123 Main St, Edmonton, AB" },
    } satisfies WordPressSite;
    expect(resolveEntityClusterLocationLabel(site, "")).toBe("Edmonton, AB");
  });
});
