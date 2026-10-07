import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { FileText } from "lucide-react";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_COULD_NOT_COPY, NOTIFY_DOWNLOADED_MARKDOWN_FILE, NOTIFY_DOWNLOADED_OUTLINE_JSON, NOTIFY_DOWNLOADED_OUTLINE_POST_BODY, NOTIFY_GENERATE_A_REPORT_FIRST, NOTIFY_GSC_REPORT_GENERATED, NOTIFY_MARKDOWN_COPIED, NOTIFY_REPORT_ADDED_TO_KNOWLEDGE_BASE, NOTIFY_REPORT_CANCELLED, NOTIFY_SET_A_PUBLIC_SITE_URL_FOR_THIS_PROPERTY_ } from "@/lib/notify-messages";
import { runGscReportingAgentHarness } from "@/lib/gsc-reporting/gsc-reporting-agent-harness";
import { runAdsReportingAgentHarness } from "@/lib/ads-reporting/ads-reporting-agent-harness";
import {
  resolveGoogleDriveTargetFolder,
  uploadReportingMarkdownToGoogleDriveFolder,
} from "@/lib/automation-google-drive-delivery";
import {
  formatDriveMonthSegment,
  formatDriveYearSegment,
  googleDriveClientFolderName,
  inferGoogleDriveDeliveryPath,
} from "@/lib/google-drive/google-drive-folder-hierarchy";
import { formatGoogleDriveFolderUrl } from "@/lib/google-drive/google-drive-folder-presets";
import {
  openGoogleDriveAuthorize,
  useGoogleDriveConnectionStatus,
} from "@/hooks/use-google-drive-connection-status";
import { ReportingModePills, type ReportingWorkspaceMode } from "@/components/research/reporting/ReportingModePills";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import type {
  GscReportingOutlineResult,
  GscReportingPipelineProgress,
  GscReportingSectionResult,
} from "@/lib/gsc-reporting/gsc-reporting-types";
import { KB_FILES_STORAGE_KEY, type StoredFile, type WordPressSite } from "@/components/integrations/types";
import { getStoredSites, mergeServerGbpLocationIdsIntoLocalSites } from "@/components/integrations/storage";
import { cn } from "@/lib/utils";
import type { GscFetchDateRange } from "@/lib/gsc-reporting/gsc-console-ui-url";
import {
  computeCompareRangesForSpan,
  computeCompareRangesForPreset,
  monthSpanFromComparePreset,
  type GscCompareBasis,
  formatLocalYmd,
  validateGscCompareFetchRanges,
  validateGscPrimaryFetchRange,
  type GscCompareRanges,
  type GscReportStructureUi,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import type { AdsReportStructure } from "@/lib/ads-reporting/ads-reporting-types";
import type { GscReportingDateMenuTab } from "@/components/research/reporting/GscReportingComparePopover";
import { GscReportingSectionsPanel } from "@/components/research/reporting/GscReportingSectionsPanel";
import {
  gscReportingSupplementsEmpty,
  type GscReportingSupplementFiles,
} from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import { ingestGscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplement-ingest";
import { GscReportingWorkspaceHeader } from "@/components/research/reporting/GscReportingWorkspaceHeader";
import { gscReportingDetailsCanOpen } from "@/components/research/reporting/GscReportingDetailsPanel";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import { WORKSPACE_DETAILS_DIM_OVERLAY_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  BLOG_GENERATOR_TAB_ROOT_CLASS,
  BLOG_GENERATOR_WORKSPACE_BODY_CLASS,
  BLOG_GENERATOR_WORKSPACE_HEADER_CLASS,
} from "@/components/keyword-research/blog-generator-tab-classes";
import type { ReportingLane } from "@/lib/reporting/reporting-lane-artifacts";
import {
  emptyReportingLanesState,
  lanesForWorkspaceMode,
  primaryReportingLaneForMode,
  type ReportingLaneArtifacts,
} from "@/lib/reporting/reporting-lane-artifacts";
import { reportingLaneRowTitle } from "@/lib/reporting/reporting-row-display-title";

const REPORTING_ARTIFACTS_SESSION_KEY = "neo-pulse-reporting-artifacts";

type ReportingDateHarness = {
  fetchPreset: GscReportingComparePresetId;
  reportStructure: GscReportStructureUi;
  compareBasis: GscCompareBasis;
  compareRangeDraft: GscCompareRanges;
  trailingMonthCount: number | null;
  trailingMonthCountDraft: string;
};

function defaultSeoDateHarness(): ReportingDateHarness {
  return {
    fetchPreset: "mom",
    reportStructure: "compare",
    compareBasis: "previous_period",
    compareRangeDraft: computeCompareRangesForPreset("mom", new Date(), "previous_period"),
    trailingMonthCount: null,
    trailingMonthCountDraft: "",
  };
}

function defaultPpcDateHarness(): ReportingDateHarness {
  return {
    fetchPreset: "mom",
    reportStructure: "period_progress",
    compareBasis: "previous_period",
    compareRangeDraft: computeCompareRangesForSpan(3, "previous_period"),
    trailingMonthCount: 3,
    trailingMonthCountDraft: "3",
  };
}

function adsReportStructureFromUi(ui: GscReportStructureUi): AdsReportStructure {
  return ui === "period_progress" ? "filter" : "compare";
}

function clearReportingSessionArtifacts(): void {
  try {
    sessionStorage.removeItem(REPORTING_ARTIFACTS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function reportingSiteForRun(site: WordPressSite): WordPressSite {
  return getStoredSites().find((s) => s.id === site.id) ?? site;
}

function reportingSupplementsEnabled(mode: ReportingWorkspaceMode): boolean {
  return mode === "seo" || mode === "both";
}

function pinLanesForRun(mode: ReportingWorkspaceMode): Record<ReportingLane, ReportingLaneArtifacts> {
  const next = emptyReportingLanesState();
  for (const lane of lanesForWorkspaceMode(mode)) {
    next[lane] = { ...next[lane], pinned: true };
  }
  return next;
}

function comparePresetFromHarness(harness: ReportingDateHarness): "mom" | "yoy" {
  return harness.compareBasis === "previous_year" ? "yoy" : "mom";
}

function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReportingTabProps = GeneratorWorkspaceChromeBindings;

export function ReportingTab({ activeSection, onSectionChange }: ReportingTabProps) {
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const { sites } = useWordPressSites();
  const { activeWordPressSiteId, setActiveWordPressSiteId } = useWordPressOptimization();
  const enabledSites = useMemo(() => sites.filter((s) => s.enabled !== false), [sites]);

  useEffect(() => {
    if (enabledSites.length === 0) return;
    if (!activeWordPressSiteId || !enabledSites.some((s) => s.id === activeWordPressSiteId)) {
      setActiveWordPressSiteId(enabledSites[0]!.id);
    }
  }, [enabledSites, activeWordPressSiteId, setActiveWordPressSiteId]);

  const site = useMemo(() => {
    if (enabledSites.length === 0) return null;
    if (activeWordPressSiteId) {
      const m = enabledSites.find((s) => s.id === activeWordPressSiteId);
      if (m) return m;
    }
    return enabledSites[0]!;
  }, [enabledSites, activeWordPressSiteId]);

  const reportingPublicSiteUrl = useMemo(
    () => (site ? getPublicSiteUrl(site).trim() : ""),
    [site],
  );

  const [laneArtifacts, setLaneArtifacts] = useState(emptyReportingLanesState);
  const [busy, setBusy] = useState(false);
  const [progressLeg, setProgressLeg] = useState<ReportingLane | null>(null);
  const [progress, setProgress] = useState<GscReportingPipelineProgress | null>(null);
  const [reportMode, setReportMode] = useState<ReportingWorkspaceMode>("seo");
  const [seoDateHarness, setSeoDateHarness] = useState<ReportingDateHarness>(defaultSeoDateHarness);
  const [ppcDateHarness, setPpcDateHarness] = useState<ReportingDateHarness>(defaultPpcDateHarness);
  const activeDateHarness = reportMode === "ppc" ? ppcDateHarness : seoDateHarness;
  const patchDateHarness = useCallback(
    (updater: (h: ReportingDateHarness) => ReportingDateHarness) => {
      if (reportMode === "ppc") {
        setPpcDateHarness(updater);
      } else if (reportMode === "both") {
        setSeoDateHarness(updater);
        setPpcDateHarness(updater);
      } else {
        setSeoDateHarness(updater);
      }
    },
    [reportMode],
  );
  const {
    fetchPreset: gscFetchPreset,
    reportStructure: gscReportStructure,
    compareBasis: gscCompareBasis,
    compareRangeDraft,
    trailingMonthCount,
    trailingMonthCountDraft,
  } = activeDateHarness;
  const todayYmdMax = useMemo(() => formatLocalYmd(new Date()), []);
  const [lastOutline, setLastOutline] = useState<GscReportingOutlineResult | null>(null);
  const [outlinePostJson, setOutlinePostJson] = useState<string | null>(null);
  const [sectionMap, setSectionMap] = useState<Record<number, GscReportingSectionResult>>({});
  const [generatingSectionIndex, setGeneratingSectionIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [supplements, setSupplements] = useState<GscReportingSupplementFiles>(() =>
    gscReportingSupplementsEmpty(),
  );
  const [dateRangePopoverOpen, setDateRangePopoverOpen] = useState(false);
  const { connected: driveConnected, loading: driveStatusLoading } = useGoogleDriveConnectionStatus();

  const reportRunPinned = useMemo(
    () => lanesForWorkspaceMode(reportMode).some((lane) => laneArtifacts[lane].pinned),
    [reportMode, laneArtifacts],
  );

  useEffect(() => {
    const syncHarnessRanges = (
      harness: ReportingDateHarness,
      setter: React.Dispatch<React.SetStateAction<ReportingDateHarness>>,
    ) => {
      if (harness.fetchPreset === "custom_compare" && harness.trailingMonthCount == null) return;
      if (harness.trailingMonthCount != null) {
        const next = computeCompareRangesForSpan(harness.trailingMonthCount, harness.compareBasis);
        setter((h) => (h.compareRangeDraft === next ? h : { ...h, compareRangeDraft: next }));
        return;
      }
      const span = monthSpanFromComparePreset(harness.fetchPreset);
      if (span != null) {
        const next = computeCompareRangesForSpan(span, harness.compareBasis);
        setter((h) => (h.compareRangeDraft === next ? h : { ...h, compareRangeDraft: next }));
      }
    };
    syncHarnessRanges(seoDateHarness, setSeoDateHarness);
  }, [seoDateHarness.fetchPreset, seoDateHarness.trailingMonthCount, seoDateHarness.compareBasis]);

  useEffect(() => {
    const harness = ppcDateHarness;
    if (harness.fetchPreset === "custom_compare" && harness.trailingMonthCount == null) return;
    if (harness.trailingMonthCount != null) {
      const next = computeCompareRangesForSpan(harness.trailingMonthCount, harness.compareBasis);
      setPpcDateHarness((h) => (h.compareRangeDraft === next ? h : { ...h, compareRangeDraft: next }));
      return;
    }
    const span = monthSpanFromComparePreset(harness.fetchPreset);
    if (span != null) {
      const next = computeCompareRangesForSpan(span, harness.compareBasis);
      setPpcDateHarness((h) => (h.compareRangeDraft === next ? h : { ...h, compareRangeDraft: next }));
    }
  }, [ppcDateHarness.fetchPreset, ppcDateHarness.trailingMonthCount, ppcDateHarness.compareBasis]);

  const onProgress = useCallback((p: GscReportingPipelineProgress) => {
    setProgress(p);
  }, []);

  const clearGeneratedReport = useCallback(() => {
    setLaneArtifacts(emptyReportingLanesState());
    setLastOutline(null);
    setOutlinePostJson(null);
    setSectionMap({});
    setGeneratingSectionIndex(null);
    setProgressLeg(null);
  }, []);

  const resetReportArtifacts = useCallback(() => {
    clearGeneratedReport();
    setProgress(null);
  }, [clearGeneratedReport]);

  useEffect(() => {
    clearReportingSessionArtifacts();
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      clearReportingSessionArtifacts();
      resetReportArtifacts();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [resetReportArtifacts]);

  const canClearReport = useMemo(() => {
    const hasMd =
      Boolean(laneArtifacts.seo.reportMd?.trim()) || Boolean(laneArtifacts.ppc.reportMd?.trim());
    const fileCount = laneArtifacts.seo.files.length + laneArtifacts.ppc.files.length;
    return hasMd || fileCount > 0 || Boolean(lastOutline) || Object.keys(sectionMap).length > 0;
  }, [laneArtifacts, lastOutline, sectionMap]);

  const handleClearReport = useCallback(() => {
    if (busy) return;
    abortRef.current?.abort();
    abortRef.current = null;
    clearReportingSessionArtifacts();
    resetReportArtifacts();
  }, [busy, resetReportArtifacts]);

  const handleReportModeChange = useCallback(
    (mode: ReportingWorkspaceMode) => {
      if (mode === reportMode || busy) return;
      setReportMode(mode);
      resetReportArtifacts();
    },
    [busy, reportMode, resetReportArtifacts],
  );

  const applySeoOutlineFromHarness = useCallback(
    (outline: GscReportingOutlineResult, outlineRequestBodyJson: string) => {
      setLastOutline(outline);
      setOutlinePostJson(outlineRequestBodyJson);
    },
    [],
  );

  const validateSeoHarness = useCallback(
    (seoHarness: ReportingDateHarness): boolean => {
      if (!reportingPublicSiteUrl.trim()) {
        notify.error(NOTIFY_SET_A_PUBLIC_SITE_URL_FOR_THIS_PROPERTY_);
        return false;
      }
      const periodProgress = seoHarness.reportStructure === "period_progress";
      const check = periodProgress
        ? validateGscPrimaryFetchRange(seoHarness.compareRangeDraft.primary)
        : validateGscCompareFetchRanges(
            seoHarness.compareRangeDraft.primary,
            seoHarness.compareRangeDraft.compare,
          );
      if (check.ok === false) {
        notify.error(check.error);
        return false;
      }
      return true;
    },
    [reportingPublicSiteUrl],
  );

  const storeLaneHarnessResult = useCallback((lane: ReportingLane, result: {
    markdown: string;
    files: { name: string; content: string }[];
    fetchRange: GscFetchDateRange;
    compareFetchRange: GscFetchDateRange;
  }) => {
    setLaneArtifacts((prev) => ({
      ...prev,
      [lane]: {
        ...prev[lane],
        reportMd: result.markdown,
        files: result.files,
        fetchRange: result.fetchRange,
        compareFetchRange: result.compareFetchRange,
      },
    }));
  }, []);

  const handleRun = useCallback(async () => {
    if (!site) {
      notify.error("Select a site in the header.");
      return;
    }
    setDateRangePopoverOpen(false);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    await mergeServerGbpLocationIdsIntoLocalSites();
    const runSite = reportingSiteForRun(site);
    const seoHarness = seoDateHarness;
    const ppcHarness = ppcDateHarness;

    if (reportMode === "seo" || reportMode === "both") {
      if (!validateSeoHarness(seoHarness)) return;
    }

    const startLabel =
      reportMode === "ppc"
        ? "Fetching Google Ads…"
        : reportMode === "both"
          ? "Starting SEO report…"
          : "Starting…";
    const initialLeg = reportMode === "ppc" ? "ppc" : "seo";

    flushSync(() => {
      clearGeneratedReport();
      setLaneArtifacts(pinLanesForRun(reportMode));
      setBusy(true);
      setProgressLeg(initialLeg);
      setProgress({ step: 0, total: 1, label: startLabel });
    });

    try {
      const signal = abortRef.current.signal;

      const runPpcLeg = async () => {
        setProgressLeg("ppc");
        setProgress({ step: 0, total: 1, label: "Fetching Google Ads…" });
        const comparePreset = comparePresetFromHarness(ppcHarness);
        const result = await runAdsReportingAgentHarness({
          site: runSite,
          comparePreset,
          compareRanges: ppcHarness.compareRangeDraft,
          adsReportStructure: adsReportStructureFromUi(ppcHarness.reportStructure),
          signal,
          onProgress,
          onOutlineReady: ({ outline, outlineRequestBodyJson }) => {
            if (reportMode !== "both") {
              setLastOutline(outline as unknown as GscReportingOutlineResult);
              setOutlinePostJson(outlineRequestBodyJson);
            }
          },
          onSectionStart: (index) => {
            setGeneratingSectionIndex(index);
          },
          onSectionReady: (row) => {
            if (reportMode !== "both") {
              setSectionMap((m) => ({ ...m, [row.index]: row as unknown as GscReportingSectionResult }));
            }
          },
        });
        storeLaneHarnessResult("ppc", {
          markdown: result.markdown,
          files: result.files,
          fetchRange: result.fetchRange,
          compareFetchRange: result.compareFetchRange,
        });
        if (reportMode !== "both") {
          setLastOutline(result.outline as unknown as GscReportingOutlineResult);
          setOutlinePostJson(result.outlineRequestBodyJson);
          setSectionMap(Object.fromEntries(result.sectionResults.map((r) => [r.index, r as unknown as GscReportingSectionResult])));
        }
        return result;
      };

      const runSeoLeg = async () => {
        setProgressLeg("seo");
        setProgress({ step: 0, total: 1, label: "Starting SEO report…" });
        const comparePreset = comparePresetFromHarness(seoHarness);
        const result = await runGscReportingAgentHarness({
          site: runSite,
          comparePreset,
          compareRanges: seoHarness.compareRangeDraft,
          gscReportStructure: seoHarness.reportStructure,
          supplements: reportingSupplementsEnabled(reportMode) ? supplements : undefined,
          signal,
          onProgress,
          onOutlineReady: ({ outline, outlineRequestBodyJson }) => {
            applySeoOutlineFromHarness(outline, outlineRequestBodyJson);
          },
          onSectionStart: (index) => {
            setGeneratingSectionIndex(index);
          },
          onSectionReady: (row) => {
            setSectionMap((m) => ({ ...m, [row.index]: row }));
          },
        });
        storeLaneHarnessResult("seo", {
          markdown: result.markdown,
          files: result.files,
          fetchRange: result.fetchRange,
          compareFetchRange: result.compareFetchRange,
        });
        applySeoOutlineFromHarness(result.outline as GscReportingOutlineResult, result.outlineRequestBodyJson);
        setSectionMap(Object.fromEntries(result.sectionResults.map((r) => [r.index, r])));
        return result;
      };

      if (reportMode === "both") {
        await runSeoLeg();
        try {
          await runPpcLeg();
        } catch (ppcErr) {
          const ppcMsg = ppcErr instanceof Error ? ppcErr.message : String(ppcErr);
          if ((ppcErr as Error).name === "AbortError") throw ppcErr;
          setProgress({ step: 0, total: 1, label: ppcMsg });
          notify.error(`PPC report failed. SEO report is ready. ${ppcMsg}`);
          return;
        }
        notify.success("SEO and PPC reports generated");
      } else if (reportMode === "ppc") {
        await runPpcLeg();
        notify.success("PPC report generated");
      } else {
        await runSeoLeg();
        notify.success(NOTIFY_GSC_REPORT_GENERATED);
      }
      setProgress(null);
      setProgressLeg(null);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        notify.info(NOTIFY_REPORT_CANCELLED);
        setLaneArtifacts(emptyReportingLanesState());
        setProgress(null);
        setProgressLeg(null);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        if (import.meta.env.DEV) {
          console.error("[Reporting]", msg, e);
        }
        setProgress({ step: 0, total: 1, label: msg });
        notify.error(msg);
      }
    } finally {
      setBusy(false);
      setGeneratingSectionIndex(null);
      abortRef.current = null;
    }
  }, [
    site,
    seoDateHarness,
    ppcDateHarness,
    onProgress,
    clearGeneratedReport,
    reportMode,
    supplements,
    validateSeoHarness,
    storeLaneHarnessResult,
    applySeoOutlineFromHarness,
  ]);

  const executionKindForLane = (lane: ReportingLane): "gsc_reporting" | "ads_reporting" =>
    lane === "ppc" ? "ads_reporting" : "gsc_reporting";

  const copyMarkdownForLane = useCallback(
    async (lane: ReportingLane) => {
      const md = laneArtifacts[lane].reportMd?.trim();
      if (!md) {
        notify.error(NOTIFY_GENERATE_A_REPORT_FIRST);
        return;
      }
      try {
        await navigator.clipboard.writeText(md);
        notify.success(NOTIFY_MARKDOWN_COPIED);
      } catch {
        notify.error(NOTIFY_COULD_NOT_COPY);
      }
    },
    [laneArtifacts],
  );

  const downloadMarkdownForLane = useCallback(
    (lane: ReportingLane) => {
      const md = laneArtifacts[lane].reportMd?.trim();
      if (!md) {
        notify.error(NOTIFY_GENERATE_A_REPORT_FIRST);
        return;
      }
      const prefix = lane === "ppc" ? "ppc-report" : "gsc-report";
      const slug = (site?.name || prefix).replace(/\s+/g, "-");
      triggerBlobDownload(md, `${prefix}-${slug}-${Date.now()}.md`, "text/markdown;charset=utf-8");
      notify.success(NOTIFY_DOWNLOADED_MARKDOWN_FILE);
    },
    [laneArtifacts, site?.name],
  );

  const handleOpenGoogleDriveForLane = useCallback(
    async (lane: ReportingLane) => {
      if (busy || !site) return;
      if (!driveConnected) {
        if (driveStatusLoading) return;
        openGoogleDriveAuthorize();
        return;
      }
      const executionKind = executionKindForLane(lane);
      const folderPath = inferGoogleDriveDeliveryPath(executionKind);
      try {
        const folder = await resolveGoogleDriveTargetFolder({
          contract: {
            saveToGoogleDrive: true,
            googleDriveFolderSource: "path",
            googleDriveFolderPath: folderPath,
            googleDriveFolderYear: formatDriveYearSegment(),
            googleDriveFolderMonth: formatDriveMonthSegment(),
          },
          siteName: googleDriveClientFolderName(site),
          siteUrl: reportingPublicSiteUrl || site.siteUrl,
          executionKind,
        });
        if (!folder) {
          notify.error("Google Drive folder could not be resolved.");
          return;
        }
        const markdown = laneArtifacts[lane].reportMd?.trim() ?? "";
        if (markdown) {
          const upload = await uploadReportingMarkdownToGoogleDriveFolder({
            folderId: folder.folderId,
            siteName: googleDriveClientFolderName(site),
            markdown,
            executionKind,
          });
          if (!upload.success) {
            notify.error(upload.error ?? "Google Drive upload failed.");
            return;
          }
        }
        const link =
          folder.webViewLink?.trim() || formatGoogleDriveFolderUrl(folder.folderId);
        if (!link) {
          notify.error("Google Drive folder link is missing.");
          return;
        }
        window.open(link, "_blank", "noopener,noreferrer");
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Google Drive folder could not be opened.");
      }
    },
    [
      busy,
      site,
      driveConnected,
      driveStatusLoading,
      reportingPublicSiteUrl,
      laneArtifacts,
    ],
  );

  const handleExportKbForLane = useCallback(
    (lane: ReportingLane) => {
      const md = laneArtifacts[lane].reportMd?.trim();
      if (!md || !site) return;
      const ts = Date.now();
      const safe = site.name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
      const prefix = lane === "ppc" ? "ppc-report" : "gsc-report";
      const newFile: StoredFile = {
        name: `${prefix}-${safe}-${ts}.md`,
        size: md.length,
        content: md,
        starred: false,
        timestamp: ts,
      };
      const stored = localStorage.getItem(KB_FILES_STORAGE_KEY) || "[]";
      const existing = JSON.parse(stored) as StoredFile[];
      const all = [...existing, newFile];
      localStorage.setItem(KB_FILES_STORAGE_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent("kb-files-updated", { detail: { files: all } }));
      notify.success(NOTIFY_REPORT_ADDED_TO_KNOWLEDGE_BASE);
    },
    [laneArtifacts, site],
  );

  const downloadOutlineJson = useCallback(() => {
    if (!lastOutline) return;
    const slug = (site?.name || "gsc").replace(/\s+/g, "-");
    triggerBlobDownload(JSON.stringify(lastOutline, null, 2), `gsc-outline-${slug}-${Date.now()}.json`, "application/json;charset=utf-8");
    notify.success(NOTIFY_DOWNLOADED_OUTLINE_JSON);
  }, [lastOutline, site?.name]);

  const downloadOutlinePostJson = useCallback(() => {
    if (!outlinePostJson) return;
    triggerBlobDownload(outlinePostJson, `gsc-outline-openrouter-post-${Date.now()}.json`, "application/json;charset=utf-8");
    notify.success(NOTIFY_DOWNLOADED_OUTLINE_POST_BODY);
  }, [outlinePostJson]);

  const downloadSectionMd = useCallback((row: GscReportingSectionResult) => {
    const slug = (site?.name || "gsc").replace(/\s+/g, "-");
    triggerBlobDownload(
      row.markdownBlock,
      `gsc-section-${row.plan.id}-${slug}-${Date.now()}.md`,
      "text/markdown;charset=utf-8",
    );
  }, [site?.name]);

  const downloadSectionPostJson = useCallback((row: GscReportingSectionResult) => {
    triggerBlobDownload(row.requestBodyJson, `gsc-section-openrouter-${row.plan.id}-${Date.now()}.json`, "application/json;charset=utf-8");
  }, []);

  const outlineSections = lastOutline?.sections;

  const laneIsBusy = useCallback(
    (lane: ReportingLane) => {
      if (!busy) return false;
      if (reportMode === "both") return progressLeg === lane;
      return primaryReportingLaneForMode(reportMode) === lane;
    },
    [busy, reportMode, progressLeg],
  );

  const rowsByLane = useMemo(() => {
    const build = (lane: ReportingLane) => ({
      lane,
      title: reportingLaneRowTitle(lane, laneArtifacts[lane].reportMd),
      busy: laneIsBusy(lane),
      hasReport: Boolean(laneArtifacts[lane].reportMd?.trim()),
      onCopyMarkdown: () => void copyMarkdownForLane(lane),
      onDownloadMarkdown: () => downloadMarkdownForLane(lane),
      onExportKb: () => handleExportKbForLane(lane),
      onOpenGoogleDrive: () => void handleOpenGoogleDriveForLane(lane),
    });
    return {
      seo: build("seo"),
      ppc: build("ppc"),
    };
  }, [
    laneIsBusy,
    laneArtifacts,
    copyMarkdownForLane,
    downloadMarkdownForLane,
    handleExportKbForLane,
    handleOpenGoogleDriveForLane,
  ]);

  const cachedFileCount =
    laneArtifacts.seo.files.length + laneArtifacts.ppc.files.length;
  const gscFetchRange = laneArtifacts.seo.fetchRange;
  const gscCompareFetchRange = laneArtifacts.seo.compareFetchRange;

  const handleDateMenuTabChange = useCallback(
    (tab: GscReportingDateMenuTab) => {
      patchDateHarness((h) => ({
        ...h,
        reportStructure: tab === "filter" ? "period_progress" : "compare",
      }));
    },
    [patchDateHarness],
  );

  const handleSelectLastMonths = useCallback(
    (monthCount: number, dateMenuTab: GscReportingDateMenuTab) => {
      patchDateHarness((h) => ({
        ...h,
        reportStructure: dateMenuTab === "filter" ? "period_progress" : "compare",
        fetchPreset: "mom",
        trailingMonthCount: monthCount,
        trailingMonthCountDraft: String(monthCount),
        compareRangeDraft: computeCompareRangesForSpan(monthCount, h.compareBasis),
      }));
    },
    [patchDateHarness],
  );

  const handleSelectCustomDates = useCallback(() => {
    patchDateHarness((h) => ({
      ...h,
      trailingMonthCount: null,
      trailingMonthCountDraft: "",
      fetchPreset: "custom_compare",
    }));
  }, [patchDateHarness]);

  const handleCompareRangeDraftChange = useCallback(
    (updater: (prev: GscCompareRanges) => GscCompareRanges) => {
      patchDateHarness((h) => ({
        ...h,
        trailingMonthCount: null,
        trailingMonthCountDraft: "",
        compareRangeDraft: updater(h.compareRangeDraft),
      }));
    },
    [patchDateHarness],
  );

  const handleTrailingMonthCountDraftChange = useCallback(
    (value: string) => {
      patchDateHarness((h) => ({ ...h, trailingMonthCountDraft: value }));
    },
    [patchDateHarness],
  );

  const supplementsEnabled = reportingSupplementsEnabled(reportMode);

  const canOpenDetails = useMemo(
    () =>
      gscReportingDetailsCanOpen(
        Boolean(site),
        busy,
        Boolean(laneArtifacts.seo.reportMd?.trim()) ||
          Boolean(laneArtifacts.ppc.reportMd?.trim()) ||
          Boolean(lastOutline),
        cachedFileCount,
        supplementsEnabled ? supplements : undefined,
      ),
    [site, busy, laneArtifacts, lastOutline, cachedFileCount, supplementsEnabled, supplements],
  );

  const [fileDragDepth, setFileDragDepth] = useState(0);
  const showFileDropHint = supplementsEnabled && fileDragDepth > 0 && !busy;

  const handleWorkspaceDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!supplementsEnabled || busy) return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      setFileDragDepth((d) => d + 1);
    },
    [busy, supplementsEnabled],
  );

  const handleWorkspaceDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!supplementsEnabled || busy) return;
      e.preventDefault();
      setFileDragDepth((d) => Math.max(0, d - 1));
    },
    [busy, supplementsEnabled],
  );

  const handleWorkspaceDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!supplementsEnabled || busy) return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
    },
    [busy, supplementsEnabled],
  );

  const handleWorkspaceDrop = useCallback(
    (e: React.DragEvent) => {
      if (!supplementsEnabled || busy) return;
      e.preventDefault();
      setFileDragDepth(0);
      const dropped = e.dataTransfer.files;
      if (!dropped?.length) return;
      void ingestGscReportingSupplementFiles(dropped, supplements)
        .then(setSupplements)
        .catch(() => undefined);
    },
    [busy, supplementsEnabled, supplements],
  );

  if (enabledSites.length === 0) {
    return (
      <div className="local-analysis-panel space-y-2 px-0 py-1 sm:px-1">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <h2 className="min-h-[1rem] text-base font-semibold leading-normal tracking-tight text-foreground">
            GSC Reporting
          </h2>
        </div>
        <div className="neo-pulse-zone-tile--data px-2 py-3 text-[1rem] leading-normal text-muted-foreground">
          Connect a WordPress site and select it in the header to run reporting.
        </div>
      </div>
    );
  }

  return (
    <div className={BLOG_GENERATOR_TAB_ROOT_CLASS}>
      {!site ? (
        <div className="neo-pulse-zone-tile--data px-2 py-3 text-base leading-normal text-muted-foreground">
          Select a site in the header.
        </div>
      ) : !site.siteUrl?.trim() ? (
        <div className="neo-pulse-zone-tile--data px-2 py-3 text-base leading-normal text-muted-foreground">
          This site has no URL saved.
        </div>
      ) : (
        <>
          <div className={BLOG_GENERATOR_WORKSPACE_HEADER_CLASS}>
            <GscReportingWorkspaceHeader
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              titleRowMenu={
                <ReportingModePills mode={reportMode} onModeChange={handleReportModeChange} disabled={busy} />
              }
              onDetailsOpenChange={setDetailsDrawerOpen}
              busy={busy}
              progress={progress}
              reportRunPinned={reportRunPinned}
              reportMode={reportMode}
              progressLeg={progressLeg}
              canOpenDetails={canOpenDetails}
              outlineSections={outlineSections}
              sectionMap={sectionMap}
              generatingSectionIndex={generatingSectionIndex}
              toolbarProps={{
                busy,
                gscReportStructure,
                onDateMenuTabChange: handleDateMenuTabChange,
                gscFetchPreset,
                onSelectLastMonths: handleSelectLastMonths,
                onSelectCustomDates: handleSelectCustomDates,
                compareRangeDraft,
                onCompareRangeDraftChange: handleCompareRangeDraftChange,
                trailingMonthCount,
                trailingMonthCountDraft,
                onTrailingMonthCountDraftChange: handleTrailingMonthCountDraftChange,
                todayYmdMax,
                onGenerate: () => void handleRun(),
                onCancel: () => abortRef.current?.abort(),
                canClearReport,
                onClearReport: handleClearReport,
                reportMode,
                supplements,
                onSupplementsChange: setSupplements,
                dateRangePopoverOpen,
                onDateRangePopoverOpenChange: setDateRangePopoverOpen,
              }}
              detailsProps={{
                busy,
                progress,
                siteName: site.name,
                siteUrl: reportingPublicSiteUrl || null,
                gscFetchPreset,
                gscReportStructure,
                gscFetchRange,
                gscCompareFetchRange,
                cachedFileCount,
                sectionCount: outlineSections?.length ?? 0,
                supplements: supplementsEnabled ? supplements : undefined,
                onSupplementsChange: supplementsEnabled ? setSupplements : undefined,
                reportMode,
              }}
            />
          </div>

          <div
            className={cn(
              BLOG_GENERATOR_WORKSPACE_BODY_CLASS,
              "relative flex flex-col overflow-y-hidden",
            )}
            onDragEnter={handleWorkspaceDragEnter}
            onDragLeave={handleWorkspaceDragLeave}
            onDragOver={handleWorkspaceDragOver}
            onDrop={handleWorkspaceDrop}
          >
            {showFileDropHint ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/70 text-base text-white">
                Drop files here
              </div>
            ) : null}
            {detailsDrawerOpen ? (
              <div className={WORKSPACE_DETAILS_DIM_OVERLAY_CLASS} aria-hidden />
            ) : null}
            <GscReportingSectionsPanel reportMode={reportMode} runBusy={busy} rowsByLane={rowsByLane} />
          </div>
        </>
      )}
    </div>
  );
}
