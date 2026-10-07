import { describe, expect, it } from "vitest";
import {
  GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME,
  isValidGaOrganicReportingFileContent,
  removeGaOrganicReportingFiles,
} from "@/lib/gsc-reporting/gsc-reporting-fetch";
import { buildGaTrafficExecutivePinText } from "@/lib/gsc-reporting/gsc-reporting-ga-traffic-headline";

describe("isValidGaOrganicReportingFileContent", () => {
  it("rejects GA error stub files", () => {
    expect(
      isValidGaOrganicReportingFileContent(
        GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME,
        "# GA4 data could not be loaded for this report.\n# denied\n",
      ),
    ).toBe(false);
  });
});

describe("buildGaTrafficExecutivePinText", () => {
  it("pins period Organic Search sessions and forbids GSC-as-traffic", () => {
    const csv = [
      "# GA4 Traffic acquisition: Organic Search (2026-07-01 → 2026-09-30)",
      "Month,Sessions,Engaged sessions,Engagement rate,Avg engagement time per session,Events per session,Event count,Key events",
      "September 2026,1200,1196,99.67%,0s,6.10,7323,11",
      "",
      "# Period total (Organic Search channel, full report range)",
      "Metric,Value",
      "Sessions,3200",
      "Engaged sessions,3100",
      "Engagement rate,95.00%",
      "Average engagement time per session,0s",
      "Events per session,6.10",
      "Event count,19000",
      "Key events,30",
    ].join("\n");
    const text = buildGaTrafficExecutivePinText({
      files: [{ name: GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME, content: csv }],
      compareKind: "period_progress",
    });
    expect(text).toMatch(/GA4_WEBSITE_TRAFFIC/);
    expect(text).toMatch(/3,200/);
    expect(text).toMatch(/FORBIDDEN.*GSC clicks/i);
  });
});

describe("removeGaOrganicReportingFiles", () => {
  it("drops stale GA files so bundle can refetch", () => {
    const files = [
      { name: GA_ORGANIC_TRAFFIC_ACQUISITION_BY_MONTH_FILENAME, content: "# GA4 data could not be loaded\n" },
      { name: "Queries-Period.csv", content: "q" },
    ];
    removeGaOrganicReportingFiles(files);
    expect(files).toHaveLength(1);
    expect(files[0]!.name).toBe("Queries-Period.csv");
  });
});
