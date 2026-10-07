export const defaultChatGptUrl = "https://chatgpt.com";

const COMPOSER_POLL_INTERVAL_MS = 2_000;
const REPLY_POLL_INTERVAL_MS = 1_500;
const NEW_CHAT_POLL_INTERVAL_MS = 1_500;

const COMPOSER_SELECTOR =
  '#prompt-textarea, [contenteditable="true"]#prompt-textarea, div[contenteditable="true"]';

export function isNavigationContextError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Execution context was destroyed")
    || message.includes("Cannot find context")
    || message.includes("Cannot take screenshot")
    || message.includes("Target closed")
    || message.includes("Session closed")
  );
}

export async function evaluateOnPageSafe(page, pageFunction, ...args) {
  try {
    return await page.evaluate(pageFunction, ...args);
  } catch (error) {
    if (isNavigationContextError(error)) return undefined;
    throw error;
  }
}

export async function evaluateHandleSafe(handle, pageFunction, ...args) {
  if (!handle) return undefined;
  try {
    return await handle.evaluate(pageFunction, ...args);
  } catch (error) {
    if (isNavigationContextError(error)) return undefined;
    throw error;
  }
}

export async function isLoggedIn(page) {
  const result = await evaluateOnPageSafe(page, () => {
    const loginSelectors = [
      '[data-testid="login-button"]',
      'button[data-testid="welcome-login-button"]',
      'a[href*="auth/login"]',
    ];
    for (const selector of loginSelectors) {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width > 8 && rect.height > 8) return false;
    }
    const nodes = [...document.querySelectorAll("button, a, [role='button']")];
    for (const label of ["Log in", "Login", "Sign up"]) {
      const match = nodes.find((node) => node.textContent?.trim().toLowerCase() === label.toLowerCase());
      if (!(match instanceof HTMLElement)) continue;
      const rect = match.getBoundingClientRect();
      if (rect.width > 8 && rect.height > 8) return false;
    }
    return true;
  });
  return result === true;
}

export async function isComposerReady(page) {
  if (!(await isLoggedIn(page))) return false;
  const result = await evaluateOnPageSafe(page, () => {
    const textarea = document.querySelector("#prompt-textarea");
    if (textarea instanceof HTMLTextAreaElement && !textarea.disabled) return true;
    const editable = document.querySelector('[contenteditable="true"]#prompt-textarea, div[contenteditable="true"]');
    return editable instanceof HTMLElement;
  });
  return result === true;
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} [url]
 * @param {{ timeoutMs?: number, waitForComposer?: boolean }} [options]
 */
export async function gotoChatGpt(page, url = defaultChatGptUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const waitForComposer = options.waitForComposer !== false;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  if (!waitForComposer) return;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isComposerReady(page)) return;
    await new Promise((resolve) => setTimeout(resolve, COMPOSER_POLL_INTERVAL_MS));
  }
  throw new Error(`ChatGPT composer did not become ready at ${url}`);
}

async function clickNewChatButton(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll("a, button, [role='button']")];
    let best = null;
    let bestArea = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const text = node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      if (text !== "new chat" && !text.startsWith("new chat ")) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) continue;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = node;
        bestArea = area;
      }
    }
    if (!(best instanceof HTMLElement)) return false;
    best.click();
    return true;
  });
}

async function tryNewChatKeyboardShortcut(page) {
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.down(modifier);
  await page.keyboard.down("Shift");
  await page.keyboard.press("o");
  await page.keyboard.up("Shift");
  await page.keyboard.up(modifier);
}

export async function startNewChat(page, progress) {
  progress?.step("Starting new chat");
  await progress?.screenshot(page, "Starting new chat", { force: true });

  const clicked = await clickNewChatButton(page);
  if (!clicked) {
    await tryNewChatKeyboardShortcut(page);
  }

  let deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await isComposerReady(page)) {
      progress?.step("New chat ready");
      await progress?.screenshot(page, "New chat ready", { force: true });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, NEW_CHAT_POLL_INTERVAL_MS));
  }

  progress?.step("New chat reload (proxy heavy)");
  await gotoChatGpt(page, defaultChatGptUrl);

  deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await isComposerReady(page)) {
      progress?.step("New chat ready");
      await progress?.screenshot(page, "New chat ready", { force: true });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, NEW_CHAT_POLL_INTERVAL_MS));
  }

  throw new Error("ChatGPT new chat composer did not become ready.");
}

async function focusComposer(page) {
  await page.waitForSelector(COMPOSER_SELECTOR, { timeout: 10_000 });
  await page.click(COMPOSER_SELECTOR);
}

async function isSendButtonEnabled(page) {
  return page.evaluate(() => {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Send"]',
      'button[aria-label*="Send"]',
    ];
    for (const selector of selectors) {
      for (const send of document.querySelectorAll(selector)) {
        if (send instanceof HTMLButtonElement && !send.disabled) return true;
      }
    }
    const composer = document.querySelector("#prompt-textarea, [contenteditable=\"true\"]");
    const form = composer?.closest("form");
    if (form) {
      const submit = form.querySelector("button:not([disabled])");
      if (submit instanceof HTMLButtonElement) return true;
    }
    return false;
  });
}

export function composerSubmitLooksAccepted(snapshot, baseline) {
  if (snapshot.generating) return true;
  if (snapshot.userMessageCount > baseline.userMessageCount) return true;
  const typedLen = baseline.composerText.trim().length;
  const currentLen = snapshot.composerText.trim().length;
  if (typedLen >= 20 && currentLen < 20) return true;
  if (typedLen > 0 && typedLen < 20 && currentLen === 0) return true;
  return false;
}

export async function readComposerSnapshot(page) {
  return page.evaluate(() => {
    const composer = document.querySelector(
      '#prompt-textarea, [contenteditable="true"]#prompt-textarea, div[contenteditable="true"]',
    );
    let composerText = "";
    if (composer instanceof HTMLTextAreaElement) composerText = composer.value.trim();
    else if (composer instanceof HTMLElement) {
      composerText = (composer.innerText ?? composer.textContent ?? "").trim();
    }
    const userMessageCount = document.querySelectorAll('[data-message-author-role="user"]').length;
    const generating = Boolean(
      document.querySelector(
        'button[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label*="Stop"]',
      ),
    );
    return { composerText, userMessageCount, generating };
  });
}

export async function readAssistantMessageCount(page) {
  return page.evaluate(
    () => document.querySelectorAll('[data-message-author-role="assistant"]').length,
  );
}

export async function assertComposerSubmitted(page, baseline) {
  const submitBaseline =
    baseline ??
    (await readComposerSnapshot(page).then((snapshot) => ({
      composerText: snapshot.composerText,
      userMessageCount: snapshot.userMessageCount,
    })));
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const snapshot = await readComposerSnapshot(page);
    if (composerSubmitLooksAccepted(snapshot, submitBaseline)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("ChatGPT did not accept the prompt (composer still has text).");
}

export async function typeIntoComposer(page, text) {
  await focusComposer(page);
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(text, { delay: 4 });

  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    if (await isSendButtonEnabled(page)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("ChatGPT send button did not enable after typing the prompt.");
}

export async function submitComposer(page, baseline) {
  const submitBaseline =
    baseline ??
    (await readComposerSnapshot(page).then((snapshot) => ({
      composerText: snapshot.composerText,
      userMessageCount: snapshot.userMessageCount,
    })));
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const clicked = await page.evaluate(() => {
      const selectors = [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[aria-label="Send"]',
        'button[aria-label*="Send"]',
      ];
      for (const selector of selectors) {
        for (const send of document.querySelectorAll(selector)) {
          if (send instanceof HTMLButtonElement && !send.disabled) {
            send.click();
            return true;
          }
        }
      }
      return false;
    });
    if (clicked) {
      await assertComposerSubmitted(page, submitBaseline);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await page.keyboard.press("Enter");
  await assertComposerSubmitted(page, submitBaseline);
}

export async function readLatestAssistantText(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const last = nodes[nodes.length - 1];
    if (!last) return "";
    const markdown =
      last.querySelector(".markdown, [class*=\"markdown\"], .prose, [data-testid=\"conversation-turn\"] .markdown");
    return (markdown?.textContent ?? last.textContent ?? "").trim();
  });
}

export async function waitForAssistantReply(page, progress, baseline = {}) {
  const opts = typeof baseline === "string" ? { previousText: baseline } : baseline;
  const previousText = opts.previousText ?? "";
  const previousAssistantCount = opts.previousAssistantCount ?? 0;
  progress.step("Waiting for ChatGPT reply");
  const deadline = Date.now() + 300_000;
  const waitStarted = Date.now();
  let lastText = previousText;
  let stableSince = 0;

  while (Date.now() < deadline) {
    const current = await readLatestAssistantText(page);
    const assistantCount = await readAssistantMessageCount(page);
    const hasNewAssistantTurn =
      assistantCount > previousAssistantCount && current.trim().length > 0;
    if (!hasNewAssistantTurn && Date.now() - waitStarted >= 90_000) {
      const snap = await readComposerSnapshot(page);
      if (snap.composerText.trim().length >= 20) {
        throw new Error("ChatGPT never started a reply; the prompt is still in the composer.");
      }
    }
    if (hasNewAssistantTurn && current !== previousText) {
      if (current === lastText) {
        if (stableSince === 0) stableSince = Date.now();
        if (Date.now() - stableSince >= 2_000) {
          progress.step("Reply received");
          await progress.screenshot(page, "Reply received", { force: true });
          return current;
        }
      } else {
        lastText = current;
        stableSince = 0;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, REPLY_POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for ChatGPT reply.");
}
