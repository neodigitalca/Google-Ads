import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NEO_PULSE_APP_DISPATCHER_MARKERS, NEO_PULSE_APP_VISIBLE_TAB_ROUTES } from "./route-registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dispatcherPath = join(__dirname, "../includes/router/class-api-dispatcher.php");
const dispatcherSource = readFileSync(dispatcherPath, "utf8");

describe("neo-pulse-app route registry", () => {
  it("registers visible-tab handlers in the dispatcher", () => {
    for (const marker of NEO_PULSE_APP_DISPATCHER_MARKERS) {
      expect(dispatcherSource).toContain(marker.split("::")[0]);
    }
  });

  it("lists expected visible-tab paths", () => {
    expect(NEO_PULSE_APP_VISIBLE_TAB_ROUTES.length).toBeGreaterThanOrEqual(8);
    const gmb = NEO_PULSE_APP_VISIBLE_TAB_ROUTES.find((r) => r.path === "gmb/config-status");
    expect(gmb?.method).toBe("GET");
    const publish = NEO_PULSE_APP_VISIBLE_TAB_ROUTES.find((r) => r.path === "google-ads/publish-campaign");
    expect(publish?.method).toBe("POST");
  });

  it("registers the Google Ads publish-campaign handler", () => {
    const handlerPath = join(__dirname, "../includes/google-ads/class-google-ads-route-handlers.php");
    const handlerSource = readFileSync(handlerPath, "utf8");
    expect(handlerSource).toContain("publish-campaign");
    expect(handlerSource).toContain("Neo_Pulse_App_Google_Ads_Campaign_Publisher::publish_campaign");
  });

  it("registers fetch-ppc-research-signals", () => {
    const fetchRoute = NEO_PULSE_APP_VISIBLE_TAB_ROUTES.find((r) => r.path === "google-ads/fetch-ppc-research-signals");
    expect(fetchRoute?.method).toBe("POST");
    const handlerPath = join(__dirname, "../includes/google-ads/class-google-ads-route-handlers.php");
    const handlerSource = readFileSync(handlerPath, "utf8");
    expect(handlerSource).toContain("fetch-ppc-research-signals");
    expect(handlerSource).toContain("Neo_Pulse_App_Google_Ads_Ppc_Research::fetch_signals");
  });

  it("registers fetch-campaign-insights", () => {
    const fetchRoute = NEO_PULSE_APP_VISIBLE_TAB_ROUTES.find((r) => r.path === "google-ads/fetch-campaign-insights");
    expect(fetchRoute?.method).toBe("POST");
    const handlerPath = join(__dirname, "../includes/google-ads/class-google-ads-route-handlers.php");
    const handlerSource = readFileSync(handlerPath, "utf8");
    expect(handlerSource).toContain("fetch-campaign-insights");
    expect(handlerSource).toContain("Neo_Pulse_App_Google_Ads_Campaign_Insights::fetch_campaign_insights");
    const insightsSource = readFileSync(
      join(__dirname, "../includes/google-ads/class-google-ads-campaign-insights.php"),
      "utf8",
    );
    expect(insightsSource).toContain("adGroupDailySeriesById");
    expect(insightsSource).toContain("keywordDailySeriesByKey");
    expect(insightsSource).toContain("recommendations");
  });

  it("registers import-search-campaigns", () => {
    const fetchRoute = NEO_PULSE_APP_VISIBLE_TAB_ROUTES.find((r) => r.path === "google-ads/import-search-campaigns");
    expect(fetchRoute?.method).toBe("POST");
    const handlerPath = join(__dirname, "../includes/google-ads/class-google-ads-route-handlers.php");
    const handlerSource = readFileSync(handlerPath, "utf8");
    expect(handlerSource).toContain("import-search-campaigns");
    expect(handlerSource).toContain("Neo_Pulse_App_Google_Ads_Campaign_Import::import_search_campaigns");
  });
});
