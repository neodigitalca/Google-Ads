import fs from "node:fs";
import { capturePageScreenshot } from "./playwright-screenshot.mjs";

/**
 * @typedef {{ step: (label: string) => void, screenshot: (page: import("puppeteer").Page, label: string, options?: { force?: boolean }) => Promise<void>, done: (payload: Record<string, unknown>) => void, error: (message: string) => void, write?: (payload: Record<string, unknown>) => void }} ProgressWriter
 */

/**
 * @param {string | undefined | null} progressPath
 * @param {{ minScreenshotIntervalMs?: number, useCaptureHelper?: boolean, includeWrite?: boolean }} [options]
 * @returns {ProgressWriter}
 */
export function createProgressWriter(progressPath, options = {}) {
  const minScreenshotIntervalMs = options.minScreenshotIntervalMs ?? 0;
  const useCaptureHelper = options.useCaptureHelper === true;
  const includeWrite = options.includeWrite === true;

  if (!progressPath) {
    return {
      step() {},
      async screenshot() {},
      done() {},
      error() {},
      ...(includeWrite ? { write() {} } : {}),
    };
  }

  const write = (payload) => {
    fs.appendFileSync(progressPath, `${JSON.stringify(payload)}\n`, "utf8");
  };

  let lastScreenshotAt = 0;

  return {
    step(label) {
      write({ type: "step", label });
    },
    async screenshot(page, label, screenshotOptions = {}) {
      const force = screenshotOptions?.force === true;
      const now = Date.now();
      if (!force && minScreenshotIntervalMs > 0 && now - lastScreenshotAt < minScreenshotIntervalMs) {
        write({ type: "step", label, capturedAt: new Date().toISOString() });
        return;
      }

      let jpegBase64;
      if (useCaptureHelper) {
        jpegBase64 = await capturePageScreenshot(page);
      } else {
        jpegBase64 = await page.screenshot({
          type: "jpeg",
          quality: 72,
          encoding: "base64",
        });
      }

      const capturedAt = new Date().toISOString();
      if (!jpegBase64) {
        write({ type: "step", label: `${label} (preview unavailable)`, capturedAt });
        return;
      }
      lastScreenshotAt = now;
      write({
        type: "screenshot",
        label,
        pngBase64: jpegBase64,
        mime: "image/jpeg",
        capturedAt,
      });
    },
    done(payload) {
      write({ type: "done", ...payload });
    },
    error(message) {
      write({ type: "error", message });
    },
    ...(includeWrite ? { write } : {}),
  };
}

const DEFAULT_WAIT_INTERVAL_MS = 1_000;

/**
 * @param {import("puppeteer").Page | null | undefined} page
 * @param {ProgressWriter | null | undefined} progress
 * @param {string} label
 * @param {number} totalMs
 * @param {{ intervalMs?: number, forceFirstScreenshot?: boolean }} [options]
 */
export async function waitWithProgressScreenshots(page, progress, label, totalMs, options = {}) {
  const intervalMs = options.intervalMs ?? DEFAULT_WAIT_INTERVAL_MS;
  const forceFirst = options.forceFirstScreenshot === true;

  if (page && progress && totalMs > 0) {
    await progress.screenshot(page, label, forceFirst ? { force: true } : {});
  }
  if (!page || !progress || totalMs <= 0) {
    if (totalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, totalMs));
    }
    return;
  }

  const started = Date.now();
  while (Date.now() - started < totalMs) {
    await progress.screenshot(page, label);
    const remaining = totalMs - (Date.now() - started);
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
}
