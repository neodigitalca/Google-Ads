import { describe, expect, it } from "vitest";
import { pickGa4OrganicAcquisition } from "@/components/integrations/types";

describe("pickGa4OrganicAcquisition", () => {
  const block = {
    current: {
      sessions: 742,
      engagedSessions: 1,
      engagementRate: 0.25,
      averageSessionDurationSec: 120,
      keyEvents: 0,
      eventCount: 0,
      eventsPerSession: 0,
    },
    previous: {
      sessions: 504,
      engagedSessions: 182,
      engagementRate: 0.36,
      averageSessionDurationSec: 90,
      keyEvents: 0,
      eventCount: 0,
      eventsPerSession: 0,
    },
  };

  it("prefers organicAcquisition when present", () => {
    expect(
      pickGa4OrganicAcquisition({
        organicAcquisition: block,
        organicTrafficAcquisition: { current: block.current, previous: { ...block.previous, sessions: 1 } },
      }),
    ).toBe(block);
  });

  it("falls back to organicTrafficAcquisition (neopulse.local report-data shape)", () => {
    expect(
      pickGa4OrganicAcquisition({
        organicTrafficAcquisition: block,
      }),
    ).toEqual(block);
  });
});
