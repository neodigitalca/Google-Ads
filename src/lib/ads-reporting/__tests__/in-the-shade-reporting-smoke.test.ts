import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { setPostCreatorWorkerApiBase } from "@/lib/wordpress-api/connection";
import { computeCompareRangesForSpan } from "@/lib/reporting/reporting-date-presets";
import { fetchAdsReportingBundle } from "@/lib/ads-reporting/ads-reporting-fetch";
import { runAdsReportingPipeline } from "@/lib/ads-reporting/ads-reporting-pipeline";
import { getAdsModel } from "@/lib/optimization-settings-storage";
import { backendApiUrl } from "@/lib/wordpress-api/connection";

const IN_THE_SHADE_CUSTOMER_ID = "3177712331";
const REFERENCE = new Date("2026-10-05T18:00:00Z");

async function resolveOpenRouterKeyForSmoke(): Promise<string> {
  const res = await fetch(backendApiUrl("/integrations/resolved-openrouter-key"), {
    credentials: "include",
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { key?: string };
  return typeof data.key === "string" ? data.key.trim() : "";
}

describe("In the Shade PPC reporting smoke", () => {
  beforeAll(() => {
    setPostCreatorWorkerApiBase(process.env.NEO_PULSE_SMOKE_API_BASE ?? "http://127.0.0.1:8080");
  });

  it(
    "loads Jul-Sep 2026 Ads bundle and produces markdown",
    async () => {
      const ranges = computeCompareRangesForSpan(3, "previous_period", REFERENCE);
      expect(ranges.primary.startDate).toBe("2026-07-01");
      expect(ranges.primary.endDate).toBe("2026-09-30");

      const bundle = await fetchAdsReportingBundle(IN_THE_SHADE_CUSTOMER_ID, ranges, {
        reportStructure: "period_progress",
        compareKind: "period_progress",
        compareLabel: "Jul 1 - Sep 30, 2026",
      });
      expect(bundle.files.length).toBeGreaterThan(0);

      const apiKey = await resolveOpenRouterKeyForSmoke();
      if (!apiKey) {
        throw new Error("OpenRouter key missing on local API (Settings).");
      }

      const result = await runAdsReportingPipeline({
        apiKey,
        model: getAdsModel("in-the-shade-smoke"),
        siteName: "In the Shade",
        siteUrl: "https://intheshadeflorida.com",
        files: bundle.files,
        compareKind: "period_progress",
        compareLabel: "Jul 1 - Sep 30, 2026",
      });

      expect(result.markdown.trim().length).toBeGreaterThan(500);
      expect(result.sectionResults.length).toBeGreaterThan(0);

      const outDir = path.join(process.cwd(), "tmp");
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, "in-the-shade-ppc-report.md"), result.markdown.trim(), "utf8");
    },
    600_000,
  );
});
