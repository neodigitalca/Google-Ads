import { describe, expect, it } from "vitest";
import { groupPropertyConnectionActions } from "./property-connection-action-groups";

describe("groupPropertyConnectionActions", () => {
  it("assigns actions to wordpress, google, and discovery groups", () => {
    const actions = [
      { key: "test", label: "Test" },
      { key: "ga", label: "GA" },
      { key: "sitemaps", label: "Sitemaps" },
    ];
    const grouped = groupPropertyConnectionActions(actions);
    expect(grouped.wordpress.map((a) => a.key)).toEqual(["test"]);
    expect(grouped.google.map((a) => a.key)).toEqual(["ga"]);
    expect(grouped.discovery.map((a) => a.key)).toEqual(["sitemaps"]);
  });
});
