import { describe, expect, it } from "vitest";
import { gaOrganicSessionsFromTraffic, gaTrafficAcquisitionMomCsv } from "@/lib/gsc-reporting/gsc-reporting-fetch";
import type { GA4OrganicAcquisitionPeriod } from "@/components/integrations/types";

const sampleOrganic = {
  current: {
    sessions: 742,
    engagedSessions: 504,
    engagementRate: 0.6792,
    averageSessionDurationSec: 57,
    keyEvents: 25,
    eventCount: 4485,
    eventsPerSession: 6.04,
  } satisfies GA4OrganicAcquisitionPeriod,
  previous: {
    sessions: 505,
    engagedSessions: 288,
    engagementRate: 0.5703,
    averageSessionDurationSec: 33,
    keyEvents: 7,
    eventCount: 2576,
    eventsPerSession: 5.1,
  } satisfies GA4OrganicAcquisitionPeriod,
};

describe("gaTrafficAcquisitionMomCsv", () => {
  it("emits full organic engagement MoM rows", () => {
    const csv = gaTrafficAcquisitionMomCsv(
      sampleOrganic,
      { start: "2026-09-01", end: "2026-09-30" },
      { start: "2026-08-01", end: "2026-08-31" },
    );

    expect(csv).toContain("Organic sessions,742,505,+46.9%");
    expect(csv).toContain("Engaged sessions");
    expect(csv).toContain("Engagement rate");
    expect(csv).toContain("Events per session");
    expect(csv).toContain("Event count");
    expect(csv).not.toContain("New users");
    expect(csv).toContain("Average engagement time per session");
    expect(csv).toContain("57s");
    expect(csv).toContain("33s");
    expect(csv).toContain("Events per session");
    expect(csv).toContain("Key events");
    expect(csv).not.toContain("Total sessions");
    expect(csv).not.toContain("Direct");
    expect(csv).not.toContain("Paid");
    expect(csv).toContain("Organic Search traffic acquisition");
  });

  it("throws when organic sessions are missing from both periods", () => {
    expect(() =>
      gaTrafficAcquisitionMomCsv(
        {
          current: { ...sampleOrganic.current, sessions: Number.NaN },
          previous: { ...sampleOrganic.previous, sessions: Number.NaN },
        },
        { start: "2026-09-01", end: "2026-09-30" },
        { start: "2026-08-01", end: "2026-08-31" },
      ),
    ).toThrow(/Organic Search/i);
  });

  it("reads organic sessions from traffic payload", () => {
    expect(
      gaOrganicSessionsFromTraffic({
        channels: [
          { channel: "Organic Search", sessionsCurrent: 10, sessionsPrevious: 8, change: 2, changePercent: 25 },
        ],
      }),
    ).toEqual({ sessionsCurrent: 10, sessionsPrevious: 8 });
  });
});
