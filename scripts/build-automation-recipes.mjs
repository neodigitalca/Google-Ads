/**
 * Generates wordpress-plugins/neo-pulse-app/recipes/*.json from catalog defs.
 * Run: node scripts/build-automation-recipes.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { recipes } from "./automation-recipes/recipe-catalog.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "wordpress-plugins/neo-pulse-app/recipes");
mkdirSync(outDir, { recursive: true });

function inferGscKeyword(config) {
  if (config.match === "all" && config.conditions.length > 1) return "gsc-dual-decay";
  const signal = config.conditions[0]?.signal;
  if (signal === "ctr_drop") return "gsc-ctr-drop";
  if (signal === "position_drop") return "gsc-position-drop";
  if (signal === "clicks_drop") return "gsc-clicks-drop";
  if (signal === "quick_win_slipped") return "gsc-quick-win-slipped";
  if (signal === "impressions_up_ctr_down") return "gsc-impressions-ctr-decay";
  return "gsc-custom";
}

function inferActionKeyword(kind, payload = {}) {
  if (kind === "csv_rows") return "csv-rows";
  if (kind === "chatgpt_website_audit") return "chatgpt-website-audit";
  if (kind === "content_optimizer_meta") return "content-optimizer-meta";
  if (kind === "content_optimizer") return "content-optimizer-full";
  if (kind === "post_creator") return "post-creator-monthly";
  if (kind === "gsc_reporting") return payload.comparePreset === "yoy" ? "gsc-report-yoy" : "gsc-report-mom";
  return `action-${kind || "custom"}`;
}

function taskToTriggerBlock(task) {
  if (task.scheduleMode === "calendar") {
    const rule = task.recurrenceRule ?? "none";
    const frequency = rule === "none" ? "once" : rule;
    return {
      keyword: `schedule-${frequency}`,
      kind: "calendar",
      frequency,
      startDate: (task.dueDate ?? "").slice(0, 10) || "2026-09-01",
      time: (task.dueTime ?? "09:00").slice(0, 5),
      ...(task.executionPayload?.targetBucket ? { targetBucket: task.executionPayload.targetBucket } : {}),
    };
  }
  const config = task.triggerConfig ?? {
    sources: ["gsc"],
    match: "any",
    conditions: [],
    lookbackDays: 28,
    compareDays: 28,
    pollHours: 24,
    cooldownHours: 72,
    maxUrls: 5,
  };
  if (config.sources?.[0] === "schedule") {
    return {
      keyword: "schedule-poll",
      kind: "poll",
      pollHours: config.pollHours ?? 24,
      targetBucket: task.executionPayload?.targetBucket,
      triggerConfig: config,
    };
  }
  return {
    keyword: inferGscKeyword(config),
    kind: "gsc",
    source: config.sources?.[0] ?? "gsc",
    targetBucket: task.executionPayload?.targetBucket,
    triggerConfig: config,
  };
}

function taskToActionBlock(task) {
  return {
    keyword: task.keyword === "csv-rows" ? "csv-rows" : inferActionKeyword(task.executionKind, task.executionPayload),
    executionKind: task.executionKind,
    executionPayload: task.executionPayload ?? {},
    title: task.title,
  };
}

function attachBlocks(recipe) {
  const tasks = recipe.defaultTasks ?? [];
  if (tasks.length === 0) return recipe;
  const triggerBlock = taskToTriggerBlock(tasks[0]);
  const actionBlock = taskToActionBlock(tasks[0]);
  const actionBlocks = tasks.length > 1 ? tasks.map(taskToActionBlock) : undefined;
  return { ...recipe, triggerBlock, actionBlock, ...(actionBlocks ? { actionBlocks } : {}) };
}

for (const recipe of recipes) {
  for (const task of recipe.defaultTasks ?? []) {
    if (
      task.executionPayload?.targetBucket === "pages" &&
      task.executionKind !== "content_optimizer_meta"
    ) {
      throw new Error(`${recipe.keyword}: pages bucket must use content_optimizer_meta`);
    }
  }

  const payload = {
    ...attachBlocks(recipe),
    isAutomation: true,
    kind: recipe.kind ?? "template",
  };
  const path = join(outDir, `${recipe.keyword}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log("wrote", path);
}

console.log(`Generated ${recipes.length} recipes.`);

