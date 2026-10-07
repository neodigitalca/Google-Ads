import {
  MAX_ROUNDS,
  NO_PROGRESS_MAX_ROUNDS,
  pickOpenRouterKey,
  pickVisionModel,
  buildVisionMessages,
  callOpenRouterVision,
  describeToolCall,
  settleAfterAction,
  detectNoProgress,
} from "./agent-vision-round.mjs";
import {
  capturePageScreenshot,
  collectPageState,
  executeBrowserTool,
  resolveToolsForSession,
} from "./tools.mjs";
import { detectBlocked, attachBlockResponseListener } from "./block-detect.mjs";
import { fetchSerpOrganic } from "./serp-dfs.mjs";
import {
  extractMaxPagesFromInstructions,
  resolveExecutionMode,
} from "./execution-mode.mjs";

/**
 * @param {object} input
 */
export async function runBrowserAutomationAgentLoop(input) {
  const apiKey = pickOpenRouterKey(input.env);
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for browser automation.");
  }
  const model = pickVisionModel(input.env);
  /** @type {Array<Record<string, unknown>>} */
  const actionLog = [...(input.initialActionLog ?? [])];
  const startUrl = input.page.url();
  const responseListener = attachBlockResponseListener(input.page);
  /** @type {Record<string, unknown> | null} */
  let liveSerpContext = input.serpContext ? { ...input.serpContext } : null;
  /** @type {Array<Record<string, unknown>>} */
  const deliverables = [...(input.initialDeliverables ?? [])];
  let endedWithoutTool = false;

  input.progress.step(`Browse mode: ${input.proxyMode ?? "direct"}`);

  const executionMode = resolveExecutionMode({
    instructionsText: input.instructionsText,
    targetUrl: input.targetUrl,
    browsePolicy: input.browsePolicy,
  });

  const { packs: activeToolPacks, tools: sessionTools } = resolveToolsForSession({
    instructionsText: input.instructionsText,
    browsePolicy: input.browsePolicy,
    targetUrl: input.targetUrl,
    executionMode,
  });

  input.progress.step(`Execution mode: ${executionMode.mode} (${executionMode.reason})`);
  input.progress.step(`Tool packs: ${activeToolPacks.join(", ")}`);

  const toolContext = {
    fetchSerp: fetchSerpOrganic,
    deliverables,
    preflightStatus: input.preflightStatus ?? null,
    env: input.env ?? {},
    serpContext: liveSerpContext,
    onDeliverable: (item) => {
      input.progress.write?.({
        type: "deliverable",
        filename: item.filename,
        label: item.label,
        mime: item.mime,
        kind: item.kind,
        content: item.content,
        base64: item.base64,
        capturedAt: item.capturedAt,
        url: item.url,
        rowIndex: item.rowIndex,
        rowTotal: item.rowTotal,
      });
    },
    onAuditRow: ({ csv, filename, label, url, index, total }) => {
      const item = {
        filename,
        label,
        mime: "text/csv",
        content: csv,
        kind: "csv",
        capturedAt: new Date().toISOString(),
        url,
        rowIndex: index,
        rowTotal: total,
      };
      const idx = deliverables.findIndex(
        (entry) => entry.kind === "csv" && entry.filename === filename,
      );
      if (idx >= 0) deliverables[idx] = item;
      else deliverables.push(item);
      toolContext.onDeliverable(item);
    },
    onAuditProgress: ({ index, total, url }) => {
      const path = (() => {
        try {
          return new URL(url).pathname || "/";
        } catch {
          return url;
        }
      })();
      input.progress.step(`Site audit ${index}/${total}: ${path}`);
    },
  };

  function loopResultBase(extra = {}) {
    return {
      actionLog,
      deliverables,
      preflightStatus: input.preflightStatus ?? null,
      finalUrl: input.page.url(),
      model,
      escalate: false,
      ...extra,
    };
  }

  try {
    if (executionMode.bootstrapTool && actionLog.length === 0) {
      const bootstrapArgs =
        executionMode.bootstrapTool === "audit_site_pages"
          ? (() => {
              const maxPages = extractMaxPagesFromInstructions(input.instructionsText);
              return maxPages === null ? { auditAll: true } : { maxPages };
            })()
          : {};
      input.progress.step(`Programmatic bootstrap: ${executionMode.bootstrapTool}`);
      try {
        const bootstrapResult = await executeBrowserTool(
          input.page,
          executionMode.bootstrapTool,
          bootstrapArgs,
          toolContext,
        );
        actionLog.push({
          tool: executionMode.bootstrapTool,
          args: bootstrapArgs,
          result: { ...bootstrapResult, pageUrl: input.page.url() },
          at: new Date().toISOString(),
        });
        if (executionMode.bootstrapTool === "audit_site_pages" && bootstrapResult.ok) {
          return loopResultBase({
            success: Number(bootstrapResult.failedCount ?? 0) === 0,
            summary: String(bootstrapResult.summary ?? "Site health audit complete."),
            notes: `Programmatic audit checked ${bootstrapResult.pagesChecked ?? 0} page(s). CSV: ${bootstrapResult.csvFilename ?? "site-health.csv"}`,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Programmatic bootstrap failed.";
        input.progress.step(message);
        actionLog.push({
          tool: executionMode.bootstrapTool,
          args: bootstrapArgs,
          result: { ok: false, error: message },
          at: new Date().toISOString(),
        });
      }
    }

    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (input.sessionMeta && input.proxyMode === "direct") {
        input.sessionMeta.directRounds += 1;
      }

      if (detectNoProgress(actionLog, startUrl, round)) {
        await input.progress.screenshot(input.page, "No progress");
        return loopResultBase({
          success: false,
          summary: "Browser automation stopped: typing never verified and URL unchanged.",
          notes: `No verified type after ${NO_PROGRESS_MAX_ROUNDS} rounds.`,
        });
      }

      const badResponse = responseListener.consume();
      let blockStatus = await detectBlocked(input.page);
      if (!blockStatus.blocked && badResponse) {
        blockStatus = { blocked: true, reason: `http_${badResponse.status}` };
      }

      if (blockStatus.blocked && input.onBlocked) {
        const checkpoint = {
          url: input.page.url(),
          actionLog: [...actionLog],
          round,
          serpContext: liveSerpContext,
        };
        const decision = await input.onBlocked(blockStatus, checkpoint);
        if (decision?.escalate) {
          return loopResultBase({
            success: false,
            summary: "Escalating to residential proxy after block.",
            notes: blockStatus.reason,
            escalate: true,
            checkpoint,
          });
        }
      }

      input.progress.step(`Vision planning (round ${round + 1})`);
      const pageState = await collectPageState(input.page);
      const screenshotBase64 = await capturePageScreenshot(input.page);
      await input.progress.screenshot(input.page, `Round ${round + 1}`);

      const visionContext = {
        targetUrl: input.targetUrl,
        currentUrl: input.page.url(),
        pageState,
        instructionsText: input.instructionsText,
        actionLog,
        screenshotBase64,
        browsePolicy: input.browsePolicy,
        proxyMode: input.proxyMode,
        serpContext: liveSerpContext,
        blockStatus,
        preflightStatus: input.preflightStatus,
        activeToolPacks,
        executionMode,
      };

      let messages = buildVisionMessages(visionContext);
      let response = await callOpenRouterVision({ apiKey, model, messages, tools: sessionTools });
      let call = response.toolCalls[0];

      if (!call) {
        if (response.content) {
          actionLog.push({
            tool: "assistant",
            args: {},
            result: { content: response.content },
            at: new Date().toISOString(),
          });
        }
        messages = [
          ...messages,
          {
            role: "assistant",
            content: response.content || "I will finish the task.",
          },
          {
            role: "user",
            content:
              "You must call exactly one tool. For multi-page client site checks use audit_site_pages then complete. " +
              "For screenshot tasks use capture_screenshot then complete. " +
              "For HTTP status checks use get_page_info. Never finish with text alone.",
          },
        ];
        response = await callOpenRouterVision({ apiKey, model, messages, tools: sessionTools });
        call = response.toolCalls[0];
        if (!call) {
          if (response.content) {
            actionLog.push({
              tool: "assistant",
              args: {},
              result: { content: response.content, retry: true },
              at: new Date().toISOString(),
            });
          }
          endedWithoutTool = true;
          break;
        }
      }

      let parsed = {};
      try {
        parsed = JSON.parse(call.arguments);
      } catch {
        parsed = {};
      }

      const result = await executeBrowserTool(input.page, call.name, parsed, {
        ...toolContext,
        serpContext: liveSerpContext,
      });

      if (call.name === "search_serp" && result.serp) {
        liveSerpContext = result.serp;
        toolContext.serpContext = liveSerpContext;
      }

      input.progress.step(describeToolCall(call.name, parsed, result));
      actionLog.push({
        tool: call.name,
        args: parsed,
        result: { ...result, pageUrl: input.page.url() },
        at: new Date().toISOString(),
      });

      if ((call.name === "complete" || call.name === "report_blocked") && result.done) {
        return loopResultBase({
          success: result.success,
          summary: result.summary,
          notes: result.notes,
        });
      }

      await settleAfterAction(call.name, parsed, result);
    }

    await input.progress.screenshot(input.page, "Agent stopped");
    return loopResultBase({
      success: false,
      summary: endedWithoutTool
        ? "Vision model did not call a tool."
        : "Browser automation stopped after max agent rounds.",
      notes: endedWithoutTool ? "Model returned text without a tool call after retry." : "",
    });
  } finally {
    responseListener.detach();
  }
}

