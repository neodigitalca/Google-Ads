/**
 * Automation recipe catalog definitions (data).
 */
import {
  trigger,
  action,
  calendarAction,
  POLL,
  COOLDOWN,
  SIG_IMPR_UP_CTR_DOWN,
  SIG_CLICKS,
  SIG_CTR,
  SIG_POSITION,
  SIG_QUICK_WIN,
  PAGES_META_ACTION,
  ENTITY_PAGE_CREATOR_PAYLOAD,
  ENTITY_GENERATOR_PAYLOAD,
  SAP_GENERATOR_PAYLOAD,
} from "./recipe-build-helpers.mjs";
export const recipesPartB1 = [
  {
    keyword: "sitewide-meta-sweep",
    name: "Sitewide Meta Sweep",
    description: "Meta-only sweep across all content types when ranking worsens.",
    notes: [
      POLL,
      "Scope: pages, posts, and entity URLs (all buckets).",
      "Runs when " + SIG_POSITION(4, 80).toLowerCase(),
      "Updates title and meta only, capped at 3 URLs per cycle.",
      COOLDOWN,
    ],
    category: "maintenance",
    verticals: ["general"],
    tags: ["gsc", "meta", "all"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["all"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "sitewide-meta",
        "Meta sweep all buckets on position drop",
        "content_optimizer_meta",
        "all",
        trigger([{ signal: "position_drop", operator: "gte", value: 4, minImpressions: 80 }], "any", {
          maxUrls: 3,
        }),
      ),
    ],
  },
  {
    keyword: "sitewide-decay-radar",
    name: "Sitewide Decay Radar",
    description: "Full AISEO on posts and entity pages when impressions rise but clicks fall.",
    notes: [
      POLL,
      "Scope: blog posts and entity/service-area pages (Posts + SAP buckets). Static pages are not in scope.",
      "Runs when " + SIG_IMPR_UP_CTR_DOWN.toLowerCase(),
      "NEO Pulse rewrites matched posts and entity URLs, capped at 3 per bucket per cycle.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "posts", "sap", "decay", "multi"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["posts", "sap"],
      triggerSignals: ["impressions_up_ctr_down"],
      actionCount: 2,
    },
    defaultTasks: [
      action(
        "sitewide-decay-posts",
        "Full AISEO on posts on intent decay",
        "content_optimizer",
        "posts",
        trigger([{ signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 }], "all", {
          maxUrls: 3,
        }),
      ),
      action(
        "sitewide-decay-sap",
        "Full AISEO on entity pages on intent decay",
        "content_optimizer",
        "sap",
        trigger([{ signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 }], "all", {
          maxUrls: 3,
        }),
      ),
    ],
  },
  {
    keyword: "strict-position-alert",
    name: "Strict Position Alert",
    description: "Meta and extra text on pages when ranking falls 5+ spots (major slips only).",
    notes: [
      POLL,
      "Scope: static pages (Pages bucket).",
      "Runs when " + SIG_POSITION(5, 100).toLowerCase(),
      PAGES_META_ACTION,
      "Ignores small daily ranking noise.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "pages", "meta", "strict"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "strict-position",
        "Meta optimize pages on major position drop",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "position_drop", operator: "gte", value: 5, minImpressions: 100 }]),
      ),
    ],
  },
  {
    keyword: "local-pages-watch",
    name: "Local Pages Watch",
    description: "Meta and extra text on high-traffic local landing pages when ranking slips.",
    notes: [
      POLL,
      "Scope: local landing pages in the Pages bucket (not SAP entity grids).",
      "Runs when " + SIG_POSITION(2, 200).toLowerCase(),
      "Lower position threshold (2 spots) because local SERPs move quickly.",
      PAGES_META_ACTION,
      COOLDOWN,
    ],
    category: "local-seo",
    verticals: ["local-seo", "home-services"],
    tags: ["gsc", "pages", "local", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "local-pages",
        "Meta + extra text on local pages on position drop",
        "content_optimizer_meta",
        "pages",
        trigger([{ signal: "position_drop", operator: "gte", value: 2, minImpressions: 200 }]),
      ),
    ],
  },
  {
    keyword: "dual-signal-pages",
    name: "Dual Signal Pages",
    description: "Static pages must show dual GSC decay signals before meta and extra text updates run.",
    notes: [
      POLL,
      "Scope: static pages (Pages bucket).",
      "Both checks below must pass on the same URL before anything runs:",
      SIG_IMPR_UP_CTR_DOWN,
      SIG_CLICKS(10, 100),
      PAGES_META_ACTION + " Up to 5 pages per cycle.",
      COOLDOWN,
    ],
    category: "reactive",
    verticals: ["general"],
    tags: ["gsc", "pages", "multi-signal", "meta"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer_meta"],
      targetBuckets: ["pages"],
      triggerSignals: ["impressions_up_ctr_down", "clicks_drop"],
      actionCount: 1,
    },
    defaultTasks: [
      action(
        "dual-signal",
        "Meta + extra text on pages on dual GSC decay signals",
        "content_optimizer_meta",
        "pages",
        trigger(
          [
            { signal: "impressions_up_ctr_down", operator: "gte", value: 0, minImpressions: 100 },
            { signal: "clicks_drop", operator: "gte", value: 10, minImpressions: 100 },
          ],
          "all",
        ),
      ),
    ],
  },
  {
    keyword: "entity-page-creator-monthly",
    name: "Entity page creator",
    description:
      "Generate entity locations from a Local Dominator grid, then schedule entity pages across the month.",
    notes: [
      "Requires a Local Dominator grid CSV upload (or use the Grid to entity pages workflow).",
      "Grid pins drive location picks; Wikipedia and entity sitemap validate and dedupe.",
      "Creates ad-group structured bulk CSV rows, fills GSC keywords, titles, and meta, then publishes entity pages.",
      "Default: 3 ad groups × 5 locations = 15 entity pages scheduled evenly across the month.",
      "Requires WordPress entity sitemap, OpenRouter, DataForSEO, and GSC.",
    ],
    category: "local-seo",
    verticals: ["local-seo", "general"],
    tags: ["entity", "sap", "grid", "monthly"],
    prerequisites: ["wordpress", "gsc", "entity-sitemap"],
    filters: {
      executionKinds: ["entity_page_creator"],
      targetBuckets: ["sap"],
      actionCount: 1,
    },
    defaultTasks: [
      calendarAction(
        "entity-page-creator-run",
        "Create scheduled entity pages",
        "entity_page_creator",
        { ...ENTITY_PAGE_CREATOR_PAYLOAD },
      ),
    ],
  }
];
