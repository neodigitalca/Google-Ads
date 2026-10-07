import path from "node:path";
import { fileURLToPath } from "node:url";
import { pollAgentMailOtp } from "./agentmail.mjs";
import { generateOnboardingProfile as generateOnboardingProfileCore } from "./openrouter-chatgpt-audit.mjs";
import {
  defaultChatGptUrl,
  evaluateHandleSafe,
  evaluateOnPageSafe,
  gotoChatGpt,
  isComposerReady,
  isLoggedIn,
  isNavigationContextError,
} from "./chatgpt-composer.mjs";
import {
  clearSessionFile as clearSessionFileAtPath,
  saveSessionCookies as saveSessionCookiesAtPath,
} from "../_shared/session-cookies.mjs";
import { resolveEnv } from "./lib-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionPath = path.join(__dirname, "..", "..", "..", ".chatgpt-audit-session.json");

async function saveSessionCookies(page) {
  return saveSessionCookiesAtPath(page, sessionPath);
}
function clearSessionFile() {
  clearSessionFileAtPath(sessionPath);
}

const NEW_CHAT_POLL_INTERVAL_MS = 1_500;
const PREVIEW_CAPTURE_INTERVAL_MS = 800;

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

export async function findVisibleEmailInput(root) {
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

export async function clickLoginButton(page) {
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

export async function waitForLoginButtonAndClick(page, progress, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const clicked = await clickLoginButton(page);
    if (clicked) return true;
    await progress.screenshot(page, "Waiting for Log in button");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

export function continueButtonLabels() {
  return ["Continue", "Continue with email", "Continue with Google", "Next"];
}

export async function clickFirstMatching(root, selectors, textLabels = continueButtonLabels()) {
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

export async function clickContinueInRoot(root) {
  const selectors = [
    'button[type="submit"]',
    'button[data-action="continue"]',
    'button[name="action"]',
  ];
  return clickFirstMatching(root, selectors, continueButtonLabels());
}

export async function clickContinueButton(page) {
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

export async function fillEmailField(page, email) {
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

export async function waitForEmailInput(page, timeoutMs = 30_000) {
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

export async function fillSplitOtpInputs(page, otp) {
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

export async function fillOtpOnAuthPage(page, otp) {
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

export async function submitOtpOnAuthPage(authPage, otp) {
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

export async function clearBrowserCookies(page) {
  const cookies = await page.cookies();
  if (cookies.length === 0) return;
  await page.deleteCookie(...cookies);
}

export function isBareChatGptHome(url) {
  return /^https:\/\/(www\.)?(chatgpt\.com|chat\.openai\.com)\/?(\?.*)?$/i.test(String(url ?? ""));
}

export function isAuthLoginUrl(url) {
  const value = String(url ?? "");
  return (
    /auth\.openai\.com/i.test(value)
    || /chatgpt\.com\/auth/i.test(value)
    || /chat\.openai\.com\/auth/i.test(value)
    || /openai\.com\/auth/i.test(value)
  );
}

export async function pageHasVisibleAuthEmailField(page) {
  const handle = await waitForEmailInput(page, 1_000);
  return Boolean(handle);
}

export async function resolveAuthLoginPage(browser, page, options = {}) {
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

export async function waitForAuthLoginPage(page, progress, timeoutMs = 45_000, options = {}) {
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

export async function authEmailFieldStillVisible(page, timeoutMs = 1_500) {
  const handle = await waitForEmailInput(page, timeoutMs);
  return Boolean(handle);
}

export function resolveElementFrame(handle, page) {
  const frame = handle?.frame;
  if (frame && typeof frame.$ === "function") return frame;
  return page.mainFrame();
}

export async function pageShowsVerificationCopy(page) {
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

export async function isLoggedOutHomepage(page) {
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

export async function detectLoginStep(page, timeoutMs = 2_000) {
  if (await waitForOtpInput(page, timeoutMs)) return "code_prompt";
  if (await pageShowsVerificationCopy(page)) return "code_prompt";
  if (await authEmailFieldStillVisible(page, 800)) return "email";
  if (await isLoggedOutHomepage(page)) return "logged_out_home";
  if (isAuthLoginUrl(page.url())) return "auth_unknown";
  return "unknown";
}

export async function detectLoginStepWithRetry(page, timeoutMs = 15_000) {
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

