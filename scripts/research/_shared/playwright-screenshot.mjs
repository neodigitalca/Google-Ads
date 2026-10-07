function isNavigationContextError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Execution context was destroyed")
    || message.includes("Cannot find context")
    || message.includes("Cannot take screenshot")
    || message.includes("Target closed")
    || message.includes("Session closed")
  );
}

function isScreenshotRecoverableError(error) {
  return isNavigationContextError(error);
}

/**
 * @param {import("puppeteer").Page} page
 */
export async function resolveScreenshotPage(page) {
  if (page && typeof page.isClosed === "function" && !page.isClosed()) {
    try {
      await page.evaluate(() => document.readyState);
      return page;
    } catch (error) {
      if (!isScreenshotRecoverableError(error)) throw error;
    }
  }

  const browser = page?.browser?.();
  if (!browser) return page;

  const pages = await browser.pages();
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const candidate = pages[index];
    if (candidate.isClosed()) continue;
    try {
      await candidate.evaluate(() => document.readyState);
      return candidate;
    } catch {
      continue;
    }
  }

  return page;
}

/**
 * @param {import("puppeteer").Page} page
 * @returns {Promise<string | null>}
 */
export async function capturePageScreenshot(page) {
  const target = await resolveScreenshotPage(page);
  if (!target || (typeof target.isClosed === "function" && target.isClosed())) {
    return null;
  }

  const options = {
    type: "jpeg",
    quality: 78,
    encoding: "base64",
    captureBeyondViewport: false,
  };

  try {
    return await target.screenshot(options);
  } catch (error) {
    if (!isScreenshotRecoverableError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const retryTarget = await resolveScreenshotPage(page);
    if (!retryTarget || (typeof retryTarget.isClosed === "function" && retryTarget.isClosed())) {
      return null;
    }
    try {
      return await retryTarget.screenshot(options);
    } catch (retryError) {
      if (!isScreenshotRecoverableError(retryError)) throw retryError;
      return null;
    }
  }
}
