import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  enableChatGptLeanBrowsing,
  shouldAbortChatGptProxyRequest,
} from "./chatgpt-lean-browsing.mjs";
import { loadEnvFile, mergeProcessEnv, requireEnv as requireEnvShared } from "../_shared/env.mjs";
import {
  applySessionCookies as applySessionCookiesAtPath,
  saveSessionCookies as saveSessionCookiesAtPath,
  readSessionFile as readSessionFileAtPath,
  clearSessionFile as clearSessionFileAtPath,
  sessionCookiesAreStale,
} from "../_shared/session-cookies.mjs";
import {
  capturePageScreenshot,
  resolveScreenshotPage,
} from "../_shared/playwright-screenshot.mjs";
import { createProgressWriter as createSharedProgressWriter } from "../_shared/progress-writer.mjs";
import { pollAgentMailOtp } from "./agentmail.mjs";
import {
  composeChatGptAuditPrompt as composeChatGptAuditPromptCore,
  generateOnboardingProfile as generateOnboardingProfileCore,
  pickOpenRouterKey,
} from "./openrouter-chatgpt-audit.mjs";
import {
  defaultChatGptUrl,
  evaluateHandleSafe,
  evaluateOnPageSafe,
  gotoChatGpt,
  isComposerReady,
  isLoggedIn,
  isNavigationContextError,
} from "./chatgpt-composer.mjs";

export { enableChatGptLeanBrowsing, shouldAbortChatGptProxyRequest };
export { capturePageScreenshot, resolveScreenshotPage, sessionCookiesAreStale };
export {
  extractOtpFromText,
  fetchAgentMailMessages,
  fetchAgentMailMessageBody,
  pollAgentMailOtp,
} from "./agentmail.mjs";
export {
  readNewQueryEntries,
  readControlPayload,
  readControlAction,
  clearControlFile,
  slugify,
} from "./batch-io.mjs";
export { pickOpenRouterKey };
export {
  defaultChatGptUrl,
  gotoChatGpt,
  isLoggedIn,
  isComposerReady,
  startNewChat,
  composerSubmitLooksAccepted,
  readComposerSnapshot,
  readAssistantMessageCount,
  assertComposerSubmitted,
  typeIntoComposer,
  submitComposer,
  readLatestAssistantText,
  waitForAssistantReply,
} from "./chatgpt-composer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.join(__dirname, "..", "..", "..");
export const envPath = path.join(repoRoot, ".env.chatgpt-audit");
export const sessionPath = path.join(repoRoot, ".chatgpt-audit-session.json");
export const defaultAgentMailInbox = "neo-pulse@agentmail.to";

export async function composeChatGptAuditPrompt(input, env = resolveEnv()) {
  return composeChatGptAuditPromptCore(input, env);
}

export async function generateOnboardingProfile(env = resolveEnv()) {
  return generateOnboardingProfileCore(env);
}

export function loadEnv(filePath = envPath) {
  return loadEnvFile(filePath);
}

function loadOpenRouterFromAppSecretsPhp() {
  const secretsPath = path.join(
    repoRoot,
    "wordpress-plugins",
    "neo-pulse-app",
    "includes",
    "neo-pulse-app-secrets.php",
  );
  if (!fs.existsSync(secretsPath)) return "";
  const src = fs.readFileSync(secretsPath, "utf8");
  const match = src.match(
    /define\(\s*'NEO_PULSE_APP_OPENROUTER_API_KEY',\s*'((?:\\'|[^'])*)'/,
  );
  if (!match) return "";
  return match[1].replace(/\\'/g, "'").trim();
}

export function resolveEnv(overrides = {}) {
  const rootEnvPath = path.join(repoRoot, ".env");
  const envFileOverride = process.env.CHATGPT_AUDIT_ENV_FILE?.trim();
  const env = {
    ...loadEnv(rootEnvPath),
    ...loadEnv(envPath),
    ...(envFileOverride ? loadEnv(envFileOverride) : {}),
  };
  const merged = mergeProcessEnv(env);
  const openRouterFromSecrets = loadOpenRouterFromAppSecretsPhp();
  if (openRouterFromSecrets) {
    if (!merged.OPENROUTER_API_KEY) merged.OPENROUTER_API_KEY = openRouterFromSecrets;
    if (!merged.NEO_PULSE_APP_OPENROUTER_API_KEY) {
      merged.NEO_PULSE_APP_OPENROUTER_API_KEY = openRouterFromSecrets;
    }
  }
  return { ...merged, ...overrides };
}

export function requireEnv(name, env) {
  return requireEnvShared(
    name,
    env,
    "Set it in .env.chatgpt-audit or the environment.",
  );
}

/** @returns {import("../_shared/progress-writer.mjs").ProgressWriter} */
export function createProgressWriter(progressPath) {
  return createSharedProgressWriter(progressPath, {
    minScreenshotIntervalMs: 4_000,
    useCaptureHelper: true,
    includeWrite: true,
  });
}

const NEW_CHAT_POLL_INTERVAL_MS = 1_500;
const PREVIEW_CAPTURE_INTERVAL_MS = 800;

export async function waitWithProgressScreenshots(page, progress, label, totalMs) {
  if (page && progress && totalMs > 0) {
    await progress.screenshot(page, label, { force: true });
  }
  if (totalMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, totalMs));
  }
}

export async function applySessionCookies(page) {
  return applySessionCookiesAtPath(page, sessionPath);
}

export async function saveSessionCookies(page) {
  return saveSessionCookiesAtPath(page, sessionPath);
}

export function readSessionFile() {
  return readSessionFileAtPath(sessionPath);
}

export function clearSessionFile() {
  clearSessionFileAtPath(sessionPath);
}

const LOGIN_BUTTON_LABELS = ["log in", "login", "sign in"];

const LOGIN_BUTTON_SELECTORS = [
  '[data-testid="login-button"]',
  'button[data-testid="welcome-login-button"]',
  'a[href*="/auth/login"]',
  'a[href*="auth.openai.com"]',
  'button[aria-label*="Log in" i]',
  'button[aria-label*="Login" i]',
];

const EMAIL_INPUT_SELECTORS = [
  'input[type="email"]',
  'input[name="email"]',
  'input[name="username"]',
  'input[id="email"]',
  'input[id="username"]',
  'input[autocomplete="email"]',
  'input[autocomplete="username"]',
];

async function findVisibleEmailInput(root) {
  for (const selector of EMAIL_INPUT_SELECTORS) {
    const handle = await root.$(selector);
    if (!handle) continue;
    const visible = await evaluateHandleSafe(handle, (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    });
    if (visible) return handle;
  }
  return null;
}

async function clickLoginButton(page) {
  for (const selector of LOGIN_BUTTON_SELECTORS) {
    const handle = await page.$(selector);
    if (!handle) continue;
    const visible = await handle.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    });
    if (!visible) continue;
    await handle.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    await handle.click({ delay: 20 });
    return true;
  }

  return page.evaluate((labels) => {
    const nodes = [...document.querySelectorAll("button, a, [role='button']")];
    let best = null;
    let bestArea = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const text = node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
      const matches = labels.some((label) => text === label || text.startsWith(`${label} `));
      if (!matches) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) continue;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = node;
        bestArea = area;
      }
    }
    if (!(best instanceof HTMLElement)) return false;
    best.scrollIntoView({ block: "center", inline: "center" });
    best.click();
    return true;
  }, LOGIN_BUTTON_LABELS);
}

async function waitForLoginButtonAndClick(page, progress, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const clicked = await clickLoginButton(page);
    if (clicked) return true;
    await progress.screenshot(page, "Waiting for Log in button");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function continueButtonLabels() {
  return ["Continue", "Continue with email", "Continue with Google", "Next"];
}

async function clickFirstMatching(root, selectors, textLabels = continueButtonLabels()) {
  for (const selector of selectors) {
    const handle = await root.$(selector);
    if (!handle) continue;
    const visible = await handle.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) return false;
      if (el instanceof HTMLButtonElement && el.disabled) return false;
      return true;
    });
    if (!visible) continue;
    await handle.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
    await handle.click();
    return true;
  }
  const clicked = await root.evaluate((labels) => {
    const nodes = [...document.querySelectorAll("button, a, [role='button']")];
    let best = null;
    let bestArea = 0;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const text = node.textContent?.trim().toLowerCase() ?? "";
      const matches = labels.some((label) => {
        const normalized = label.toLowerCase();
        return text === normalized || text.startsWith(`${normalized} `);
      });
      if (!matches) continue;
      if (node instanceof HTMLButtonElement && node.disabled) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) continue;
      const area = rect.width * rect.height;
      if (area > bestArea) {
        best = node;
        bestArea = area;
      }
    }
    if (!best) return false;
    best.scrollIntoView({ block: "center", inline: "center" });
    best.click();
    return true;
  }, textLabels);
  return clicked;
}

async function clickContinueInRoot(root) {
  const selectors = [
    'button[type="submit"]',
    'button[data-action="continue"]',
    'button[name="action"]',
  ];
  return clickFirstMatching(root, selectors, continueButtonLabels());
}

async function clickContinueButton(page) {
  if (await clickContinueInRoot(page)) return true;
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      if (await clickContinueInRoot(frame)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function fillEmailField(page, email) {
  const handle = await waitForEmailInput(page, 45_000);
  if (!handle) return false;
  await handle.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await handle.type(email, { delay: 15 });
  let value = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  if (value !== email.trim()) {
    await handle.evaluate((el, nextEmail) => {
      if (!("value" in el)) return;
      el.value = nextEmail;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, email.trim());
    value = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  }
  return value === email.trim();
}

async function waitForEmailInput(page, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const onPage = await findVisibleEmailInput(page);
    if (onPage) return onPage;

    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const inFrame = await findVisibleEmailInput(frame);
        if (inFrame) return inFrame;
      } catch {
        continue;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function fillSplitOtpInputs(page, otp) {
  const digits = String(otp ?? "").trim().split("");
  if (digits.length < 4) return false;

  return page.evaluate((codeDigits) => {
    const inputs = [...document.querySelectorAll("input")].filter((node) => {
      if (!(node instanceof HTMLInputElement)) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) return false;
      const mode = `${node.inputMode} ${node.type} ${node.autocomplete} ${node.name}`.toLowerCase();
      return (
        mode.includes("numeric")
        || mode.includes("one-time-code")
        || node.maxLength === 1
        || node.getAttribute("aria-label")?.toLowerCase().includes("code")
      );
    });

    if (inputs.length < codeDigits.length) return false;
    codeDigits.forEach((digit, index) => {
      const input = inputs[index];
      if (!(input instanceof HTMLInputElement)) return;
      input.focus();
      input.value = digit;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return true;
  }, digits);
}

async function fillOtpOnAuthPage(page, otp) {
  let handle = await waitForOtpInput(page, 10_000);
  if (!handle) {
    return fillSplitOtpInputs(page, otp);
  }

  const typeOtp = async (target) => {
    await target.click({ clickCount: 3 });
    await target.type(otp, { delay: 25 });
  };

  try {
    await typeOtp(handle);
  } catch (error) {
    if (!isNavigationContextError(error)) throw error;
    handle = await waitForOtpInput(page, 5_000);
    if (!handle) return fillSplitOtpInputs(page, otp);
    await typeOtp(handle);
  }

  const verified = await page.evaluate((expected) => {
    const inputs = [...document.querySelectorAll("input")];
    const combined = inputs
      .map((node) => (node instanceof HTMLInputElement ? node.value : ""))
      .join("");
    if (combined.includes(expected)) return true;
    const single = inputs.find((node) => {
      if (!(node instanceof HTMLInputElement)) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8 && node.value.includes(expected);
    });
    return Boolean(single);
  }, otp);

  if (verified) return true;
  return fillSplitOtpInputs(page, otp);
}

async function submitOtpOnAuthPage(authPage, otp) {
  const handle = await waitForOtpInput(authPage, 5_000);
  const navigationWait = authPage
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => null);

  if (handle) {
    const frame = resolveElementFrame(handle, authPage);
    const clicked = await clickContinueInRoot(frame);
    if (!clicked) {
      await clickContinueButton(authPage);
    }
  } else {
    await clickContinueButton(authPage);
  }

  await navigationWait;
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  if (await isComposerReady(authPage)) return true;

  if (handle) {
    await progressSafeFocus(handle);
    await authPage.keyboard.press("Enter");
    await authPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null);
  }
  return true;
}

async function clearBrowserCookies(page) {
  const cookies = await page.cookies();
  if (cookies.length === 0) return;
  await page.deleteCookie(...cookies);
}

function isBareChatGptHome(url) {
  return /^https:\/\/(www\.)?(chatgpt\.com|chat\.openai\.com)\/?(\?.*)?$/i.test(String(url ?? ""));
}

function isAuthLoginUrl(url) {
  const value = String(url ?? "");
  return (
    /auth\.openai\.com/i.test(value)
    || /chatgpt\.com\/auth/i.test(value)
    || /chat\.openai\.com\/auth/i.test(value)
    || /openai\.com\/auth/i.test(value)
  );
}

async function pageHasVisibleAuthEmailField(page) {
  const handle = await waitForEmailInput(page, 1_000);
  return Boolean(handle);
}

async function resolveAuthLoginPage(browser, page, options = {}) {
  const allowHomeModal = options.allowHomeModal === true;

  async function check(candidate) {
    try {
      if (!(await pageHasVisibleAuthEmailField(candidate))) return null;
      const url = candidate.url();
      if (isAuthLoginUrl(url)) return candidate;
      if (allowHomeModal && isBareChatGptHome(url)) return candidate;
      if (!isBareChatGptHome(url)) return candidate;
      return null;
    } catch (error) {
      if (isNavigationContextError(error)) return null;
      throw error;
    }
  }

  const direct = await check(page);
  if (direct) return direct;

  for (const candidate of await browser.pages()) {
    if (candidate === page) continue;
    const found = await check(candidate);
    if (found) return found;
  }

  return null;
}

async function waitForAuthLoginPage(page, progress, timeoutMs = 45_000, options = {}) {
  const browser = page.browser();
  const deadline = Date.now() + timeoutMs;
  let lastCaptureMs = 0;

  while (Date.now() < deadline) {
    const authPage = await resolveAuthLoginPage(browser, page, options);
    if (authPage) return authPage;
    if (progress && Date.now() - lastCaptureMs >= PREVIEW_CAPTURE_INTERVAL_MS) {
      progress.step(`Opening login flow (${page.url()})`);
      if (progress.screenshot) {
        await progress.screenshot(page, `Opening login flow (${page.url()})`);
      }
      lastCaptureMs = Date.now();
    } else {
      progress?.step(`Opening login flow (${page.url()})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

async function authEmailFieldStillVisible(page, timeoutMs = 1_500) {
  const handle = await waitForEmailInput(page, timeoutMs);
  return Boolean(handle);
}

function resolveElementFrame(handle, page) {
  const frame = handle?.frame;
  if (frame && typeof frame.$ === "function") return frame;
  return page.mainFrame();
}

async function pageShowsVerificationCopy(page) {
  const result = await evaluateOnPageSafe(page, () => {
    const text = document.body?.innerText?.replace(/\s+/g, " ").toLowerCase() ?? "";
    return (
      text.includes("verification code")
      || text.includes("enter the code")
      || text.includes("enter code")
      || text.includes("one-time code")
      || text.includes("6-digit")
      || text.includes("check your email")
      || text.includes("we sent a code")
      || text.includes("email code")
      || text.includes("inbox for a code")
    );
  });
  return result === true;
}

async function isLoggedOutHomepage(page) {
  if (!isBareChatGptHome(page.url())) return false;
  const hasAuthOverlay = await evaluateOnPageSafe(page, () => {
    const dialogs = [...document.querySelectorAll('[role="dialog"], [data-testid*="modal"], [class*="modal"]')];
    return dialogs.some((node) => {
      if (!(node instanceof HTMLElement)) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width <= 8 || rect.height <= 8) return false;
      const text = node.innerText?.replace(/\s+/g, " ").toLowerCase() ?? "";
      return (
        text.includes("email")
        || text.includes("code")
        || text.includes("continue")
        || text.includes("password")
      );
    });
  });
  if (hasAuthOverlay === undefined) return false;
  if (hasAuthOverlay) return false;
  return !(await isLoggedIn(page));
}

async function detectLoginStep(page, timeoutMs = 2_000) {
  if (await waitForOtpInput(page, timeoutMs)) return "code_prompt";
  if (await pageShowsVerificationCopy(page)) return "code_prompt";
  if (await authEmailFieldStillVisible(page, 800)) return "email";
  if (await isLoggedOutHomepage(page)) return "logged_out_home";
  if (isAuthLoginUrl(page.url())) return "auth_unknown";
  return "unknown";
}

async function detectLoginStepWithRetry(page, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const remaining = Math.max(500, deadline - Date.now());
      const step = await detectLoginStep(page, Math.min(2_000, remaining));
      if (step !== "unknown") return step;
    } catch (error) {
      if (!isNavigationContextError(error)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return "unknown";
}

async function submitEmailViaForm(emailHandle) {
  try {
    return await emailHandle.evaluate((el) => {
      if (!(el instanceof HTMLElement)) return false;

      const form = el.closest("form");
      if (form instanceof HTMLFormElement) {
        const submit = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submit instanceof HTMLElement) {
          if (submit instanceof HTMLButtonElement && submit.disabled) return false;
          submit.scrollIntoView({ block: "center", inline: "center" });
          submit.click();
          return true;
        }
        form.requestSubmit();
        return true;
      }

      const scope = el.closest('[role="dialog"], [data-testid*="modal"], [class*="modal"]');
      const root = scope instanceof HTMLElement ? scope : document.body;
      const buttons = [...root.querySelectorAll("button, [role='button']")];
      let best = null;
      let bestArea = 0;
      for (const node of buttons) {
        if (!(node instanceof HTMLElement)) continue;
        const text = node.textContent?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
        if (!text.startsWith("continue") && text !== "next") continue;
        if (node instanceof HTMLButtonElement && node.disabled) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 8 || rect.height <= 8) continue;
        const area = rect.width * rect.height;
        if (area > bestArea) {
          best = node;
          bestArea = area;
        }
      }
      if (!(best instanceof HTMLElement)) return false;
      best.scrollIntoView({ block: "center", inline: "center" });
      best.click();
      return true;
    });
  } catch (error) {
    if (isNavigationContextError(error)) {
      return true;
    }
    throw error;
  }
}

async function waitForAuthPageContent(page, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await evaluateOnPageSafe(page, () => {
      const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
      return text.length >= 15;
    });
    if (ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

async function resolveAuthPageAfterSubmit(browser, page) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const authPage = (await resolveAuthLoginPage(browser, page, { allowHomeModal: true })) ?? page;
    try {
      await authPage.evaluate(() => document.readyState);
      if (await waitForAuthPageContent(authPage, Math.max(500, deadline - Date.now()))) {
        return authPage;
      }
    } catch (error) {
      if (!isNavigationContextError(error)) throw error;
    }
  }
  return (await resolveAuthLoginPage(browser, page, { allowHomeModal: true })) ?? page;
}

async function submitEmailOnce(authPage, emailHandle, progress = null) {
  const browser = authPage.browser();
  const navigationWait = authPage
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 })
    .catch(() => null);

  let submitted = await submitEmailViaForm(emailHandle);
  if (!submitted) {
    const emailFrame = resolveElementFrame(emailHandle, authPage);
    submitted = await clickContinueInRoot(emailFrame);
  }

  await navigationWait;
  let nextPage = await resolveAuthPageAfterSubmit(browser, authPage);
  if (progress?.screenshot) {
    await progress.screenshot(nextPage, submitted ? "Email submit sent" : "Email submit pending");
  }

  let step = await detectLoginStepWithRetry(nextPage, 8_000);
  if (step === "logged_out_home") {
    return { ok: false, authPage: nextPage, step };
  }
  if (step === "code_prompt" || submitted) {
    return { ok: true, authPage: nextPage, step: step === "code_prompt" ? "code_prompt" : "email_submitted" };
  }

  if (step === "email" && !submitted) {
    const freshEmail = await waitForEmailInput(nextPage, 2_000);
    if (freshEmail) {
      await progressSafeFocus(freshEmail);
      await nextPage.keyboard.press("Enter");
      submitted = true;
      await nextPage.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => null);
      nextPage = await resolveAuthPageAfterSubmit(browser, nextPage);
      step = await detectLoginStepWithRetry(nextPage, 8_000);
      if (step === "logged_out_home") {
        return { ok: false, authPage: nextPage, step };
      }
      if (step === "code_prompt" || submitted) {
        return { ok: true, authPage: nextPage, step: step === "code_prompt" ? "code_prompt" : "email_submitted" };
      }
    }
  }

  return { ok: false, authPage: nextPage, step };
}

function progressSafeFocus(handle) {
  return handle.focus().catch((error) => {
    if (isNavigationContextError(error)) return;
    throw error;
  });
}

const OTP_INPUT_SELECTORS = [
  'input[name="code"]',
  'input[autocomplete="one-time-code"]',
  'input[inputmode="numeric"]',
  'input[placeholder*="code" i]',
  'input[aria-label*="code" i]',
  'input[maxlength="6"]',
  'input[maxlength="8"]',
];

async function findVisibleOtpInput(root) {
  for (const selector of OTP_INPUT_SELECTORS) {
    const handle = await root.$(selector);
    if (!handle) continue;
    const visible = await evaluateHandleSafe(handle, (el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    });
    if (visible) return handle;
  }
  return null;
}

async function waitForOtpInput(page, timeoutMs = 60_000, progress = null, label = "Waiting for code prompt") {
  const deadline = Date.now() + timeoutMs;
  let lastCaptureMs = 0;
  while (Date.now() < deadline) {
    if (progress && Date.now() - lastCaptureMs >= PREVIEW_CAPTURE_INTERVAL_MS) {
      await progress.screenshot(page, label);
      lastCaptureMs = Date.now();
    }

    const onPage = await findVisibleOtpInput(page);
    if (onPage) return onPage;

    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      try {
        const inFrame = await findVisibleOtpInput(frame);
        if (inFrame) return inFrame;
      } catch {
        continue;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function waitForAuthEmailField(page, timeoutMs = 45_000) {
  return waitForEmailInput(page, timeoutMs);
}

async function findVisibleInputMatching(root, hints) {
  const selectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="number"]',
    'input[inputmode="numeric"]',
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
  ];
  for (const selector of selectors) {
    const handles = await root.$$(selector);
    for (const handle of handles) {
      const matches = await handle.evaluate((el, hintList) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 8 || rect.height <= 8) return false;
        const haystack = [
          el.getAttribute("placeholder"),
          el.getAttribute("name"),
          el.getAttribute("id"),
          el.getAttribute("aria-label"),
          el.getAttribute("autocomplete"),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hintList.some((hint) => haystack.includes(hint));
      }, hints);
      if (matches) return handle;
    }
  }
  return null;
}

async function pageShowsOnboardingProfile(page) {
  const hasCopy = await page.evaluate(() => {
    const text = document.body?.innerText?.replace(/\s+/g, " ").toLowerCase() ?? "";
    return text.includes("how old are you") || text.includes("full name");
  });
  if (!hasCopy) return false;
  const nameInput = await findVisibleInputMatching(page, ["name"]);
  const ageInput = await findVisibleInputMatching(page, ["age"]);
  return Boolean(nameInput && ageInput);
}

async function fillInputValue(handle, page, value) {
  await handle.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await handle.type(String(value), { delay: 12 });
  let current = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  if (current !== String(value).trim()) {
    await handle.evaluate((el, nextValue) => {
      if (!("value" in el)) return;
      el.value = nextValue;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, String(value).trim());
    current = await handle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  }
  return current === String(value).trim();
}

async function completeOnboardingProfile(page, progress, env) {
  if (!(await pageShowsOnboardingProfile(page))) return false;

  progress.step("Completing profile setup");
  const profile = await generateOnboardingProfileCore(env);
  progress.step(`Profile: ${profile.fullName}, age ${profile.age}`);

  const nameInput = await findVisibleInputMatching(page, ["name"]);
  const ageInput = await findVisibleInputMatching(page, ["age"]);
  if (!nameInput || !ageInput) {
    throw new Error("ChatGPT profile setup fields were not found.");
  }

  const nameFilled = await fillInputValue(nameInput, page, profile.fullName);
  const ageFilled = await fillInputValue(ageInput, page, profile.age);
  if (!nameFilled || !ageFilled) {
    throw new Error("Could not fill ChatGPT profile setup fields.");
  }

  await progress.screenshot(page, "Profile fields filled");
  const clicked = await clickContinueButton(page);
  if (!clicked) {
    throw new Error("Could not submit ChatGPT profile setup form.");
  }

  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null);
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  await progress.screenshot(page, "Profile setup submitted");
  return true;
}

export async function loginChatGpt(page, progress, { email, agentmailApiKey, agentmailInbox, env = resolveEnv() }) {
  progress.step("Opening ChatGPT");
  await gotoChatGpt(page, defaultChatGptUrl, { waitForComposer: false });
  await progress.screenshot(page, "Opening ChatGPT", { force: true });

  if (await isComposerReady(page)) {
    progress.step("Already logged in");
    await progress.screenshot(page, "Already logged in", { force: true });
    await saveSessionCookies(page);
    return;
  }

  clearSessionFile();
  await clearBrowserCookies(page);
  await gotoChatGpt(page, defaultChatGptUrl, { waitForComposer: false });
  await progress.screenshot(page, "Fresh ChatGPT session", { force: true });

  progress.step("Starting login");
  await waitWithProgressScreenshots(page, progress, "Loading ChatGPT", 5_000);

  const loginClicked = await waitForLoginButtonAndClick(page, progress, 45_000);
  if (!loginClicked) {
    await progress.screenshot(page, "Log in button not found");
    throw new Error(`Could not find ChatGPT Log in button. Current URL: ${page.url()}`);
  }

  progress.step("Log in clicked");
  await progress.screenshot(page, "Log in clicked");
  await Promise.race([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 20_000)),
  ]);

  let authPage = await waitForAuthLoginPage(page, progress, 45_000, { allowHomeModal: true });
  if (!authPage) {
    await progress.screenshot(page, "Auth login page not reached");
    throw new Error(`Auth login page did not open after Log in. Current URL: ${page.url()}`);
  }

  progress.step("Login screen");
  await progress.screenshot(authPage, "Login screen");

  const emailHandle = await waitForAuthEmailField(authPage, 45_000);
  if (!emailHandle) {
    clearSessionFile();
    await progress.screenshot(authPage, "Email input not found");
    throw new Error(`Could not find email field on auth login page. Current URL: ${authPage.url()}`);
  }

  progress.step("Entering email");
  await emailHandle.click({ clickCount: 3 });
  await authPage.keyboard.press("Backspace");
  await emailHandle.type(email, { delay: 15 });
  let emailValue = await emailHandle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  if (emailValue !== email.trim()) {
    await emailHandle.evaluate((el, nextEmail) => {
      if (!("value" in el)) return;
      el.value = nextEmail;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, email.trim());
    emailValue = await emailHandle.evaluate((el) => ("value" in el ? String(el.value) : "").trim());
  }
  if (emailValue !== email.trim()) {
    await progress.screenshot(authPage, "Email entry failed");
    throw new Error(`Could not enter email on auth login page. Current URL: ${authPage.url()}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
  const emailScreenshotLabel = `Email entered: ${email}`;
  progress.step(emailScreenshotLabel);
  await progress.screenshot(authPage, emailScreenshotLabel);

  const loginStartedAt = Date.now();
  progress.step("Submitting email");
  const submitResult = await submitEmailOnce(authPage, emailHandle, progress);
  authPage = submitResult.authPage;
  if (!submitResult.ok) {
    await progress.screenshot(authPage, "Email submit failed");
    if (submitResult.step === "logged_out_home") {
      throw new Error("Email submit closed the login modal and returned to the ChatGPT homepage. OpenAI did not send a verification email.");
    }
    throw new Error("Could not click Continue on the auth login page.");
  }
  progress.step("Email submitted");
  await progress.screenshot(authPage, "Email submitted");

  progress.step("Waiting for code prompt");
  await waitWithProgressScreenshots(authPage, progress, "Waiting for code prompt", 3_000);
  const otpHandle = await waitForOtpInput(authPage, 60_000, progress, "Waiting for code prompt");
  if (!otpHandle) {
    await progress.screenshot(authPage, "Code prompt not shown");
    throw new Error("ChatGPT did not show the verification code prompt after email submit.");
  }
  await progress.screenshot(authPage, "Code prompt ready");

  const otp = await pollAgentMailOtp(agentmailApiKey, agentmailInbox, loginStartedAt, progress, authPage);
  progress.step("Entering login code");
  const otpFilled = await fillOtpOnAuthPage(authPage, otp);
  if (!otpFilled) {
    await progress.screenshot(authPage, "Login code entry failed");
    throw new Error("Could not enter ChatGPT verification code.");
  }
  await progress.screenshot(authPage, "Entering login code");

  progress.step("Submitting login code");
  await submitOtpOnAuthPage(authPage, otp);
  await progress.screenshot(authPage, "Submitting login code");

  if (!isAuthLoginUrl(page.url()) && (await isComposerReady(page))) {
    await saveSessionCookies(page);
    return;
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const activePage = isAuthLoginUrl(page.url()) ? page : authPage;
    if (await completeOnboardingProfile(page, progress, env)) {
      await waitWithProgressScreenshots(page, progress, "Finishing login", 2_000);
      continue;
    }
    if (activePage !== page && (await pageShowsOnboardingProfile(activePage))) {
      await completeOnboardingProfile(activePage, progress, env);
      await waitWithProgressScreenshots(page, progress, "Finishing login", 2_000);
      continue;
    }
    if (await isComposerReady(page)) {
      progress.step("Logged in");
      await progress.screenshot(page, "Logged in");
      await saveSessionCookies(page);
      return;
    }
    if (activePage !== page && (await isComposerReady(activePage))) {
      progress.step("Logged in");
      await progress.screenshot(activePage, "Logged in");
      await saveSessionCookies(activePage);
      return;
    }
    if (!isAuthLoginUrl(page.url()) && !page.url().includes("chatgpt.com")) {
      await gotoChatGpt(page, defaultChatGptUrl);
    }
    await new Promise((resolve) => setTimeout(resolve, NEW_CHAT_POLL_INTERVAL_MS));
  }

  throw new Error("ChatGPT login did not reach the composer.");
}
