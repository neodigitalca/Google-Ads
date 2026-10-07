/**
 * Shared builders for automation recipe catalog entries.
 */

export function trigger(conditions, match = "any", overrides = {}) {
  return {
    sources: ["gsc"],
    match,
    conditions,
    lookbackDays: 28,
    compareDays: 28,
    pollHours: 24,
    cooldownHours: 72,
    maxUrls: 5,
    ...overrides,
  };
}

export function action(keyword, title, executionKind, targetBucket, triggerConfig) {
  return {
    keyword,
    title,
    status: "todo",
    assignPulse: true,
    scheduleMode: "trigger",
    executionKind,
    executionPayload: { targetBucket, updateMode: "update" },
    triggerConfig,
  };
}

export const POLL = "Polls Google Search Console every 24 hours.";
export const COOLDOWN = "Same URL waits 72 hours before it can run again.";
export const SIG_IMPR_UP_CTR_DOWN =
  "Impressions rose vs the prior 28 days AND click-through rate fell (Google shows the page more often, but fewer searchers click).";
export const SIG_CLICKS = (pct, min) =>
  `Total clicks from Google Search fell at least ${pct}% vs the prior 28 days, with at least ${min} impressions.`;
export const SIG_CTR = (pct, min) =>
  `Click-through rate fell at least ${pct}% vs the prior 28 days (similar visibility, fewer clicks), with at least ${min} impressions.`;
export const SIG_POSITION = (spots, min) =>
  `Average ranking position worsened by at least ${spots} spots, with at least ${min} impressions.`;
export const SIG_QUICK_WIN =
  "The URL left positions 4–10 (where small ranking gains are easiest).";
export const PAGES_META_ACTION =
  "Updates title, meta description, and SEO extra text. Page body content is not rewritten.";

export function calendarAction(keyword, title, executionKind, executionPayload, recurrenceRule = "monthly") {
  return {
    keyword,
    title,
    status: "todo",
    assignPulse: true,
    scheduleMode: "calendar",
    dueDate: "2026-09-01",
    dueTime: "09:00",
    recurrenceRule,
    executionKind,
    executionPayload,
  };
}

export const ENTITY_PAGE_CREATOR_PAYLOAD = {
  locationSource: "grid",
  gridInputSource: "workflow",
  entityAdGroupCount: 3,
  entityAdsPerGroup: 5,
  entityPageCount: 15,
  postCount: 15,
  focusKeyword: "",
  titleTemplate: "{keyword} Near {entity}",
  sitemapType: "entity",
  featuredImage: false,
  postDestination: "wordpress",
  scheduleTimesPerMonth: 15,
  scheduleCustomInterval: 15,
  scheduleStartDay: 1,
  scheduleStartTime: "09:00",
  scheduleStaggerOptimized: true,
  targetBucket: "sap",
  saveLocalArchive: true,
};

export const ENTITY_GENERATOR_PAYLOAD = {
  locationSource: "grid",
  gridInputSource: "workflow",
  entityAdGroupCount: 3,
  entityAdsPerGroup: 5,
  entityPageCount: 15,
  postCount: 15,
  focusKeyword: "",
  titleTemplate: "{keyword} Near {entity}",
  sitemapType: "entity",
  targetBucket: "sap",
  saveLocalArchive: true,
};

export const SAP_GENERATOR_PAYLOAD = {
  entityAdGroupCount: 3,
  entityAdsPerGroup: 5,
  entityPageCount: 15,
  postCount: 15,
  entityCsvInputSource: "upload",
  sitemapType: "entity",
  featuredImage: false,
  postDestination: "wordpress",
  scheduleTimesPerMonth: 15,
  scheduleCustomInterval: 15,
  scheduleStartDay: 1,
  scheduleStartTime: "09:00",
  scheduleStaggerOptimized: true,
  targetBucket: "sap",
  saveLocalArchive: true,
};
