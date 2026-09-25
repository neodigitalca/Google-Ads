import { useCallback, useEffect, useRef, useState } from "react";
import { loadPpcCampaignInsights } from "@/lib/ppc/load-ppc-campaign-insights";
import {
  ppcCampaignInsightsLast30DayRange,
  type PpcCampaignInsights,
} from "@/lib/ppc/ppc-campaign-insights-types";

export type PpcCampaignInsightsStatus = "idle" | "loading" | "ready" | "error";

export function usePpcCampaignInsights(options: {
  customerId: string;
  campaignId: string | undefined;
  enabled?: boolean;
  compareStartDate?: string;
  compareEndDate?: string;
}) {
  const [status, setStatus] = useState<PpcCampaignInsightsStatus>("idle");
  const [insights, setInsights] = useState<PpcCampaignInsights | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canFetch =
    options.enabled !== false &&
    Boolean(options.customerId) &&
    Boolean(options.campaignId?.trim());

  const refresh = useCallback(async () => {
    if (!canFetch || !options.campaignId) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setErrorMessage(null);

    const range = ppcCampaignInsightsLast30DayRange();

    try {
      const result = await loadPpcCampaignInsights({
        customerId: options.customerId,
        campaignId: options.campaignId,
        startDate: range.startDate,
        endDate: range.endDate,
        compareStartDate: options.compareStartDate,
        compareEndDate: options.compareEndDate,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setInsights(result);
      setStatus("ready");
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Failed to load campaign insights.";
      setErrorMessage(message);
      setInsights(null);
      setStatus("error");
    }
  }, [
    canFetch,
    options.campaignId,
    options.customerId,
    options.compareStartDate,
    options.compareEndDate,
  ]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const fetchOnceOnOpen = useCallback(
    (open: boolean) => {
      if (!open || !canFetch) return;
      if (status === "ready" || status === "loading") return;
      void refresh();
    },
    [canFetch, refresh, status],
  );

  return {
    status,
    insights,
    errorMessage,
    refresh,
    fetchOnceOnOpen,
  };
}
