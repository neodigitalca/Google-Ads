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
export async function submitEmailViaForm(emailHandle) {
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

export async function waitForAuthPageContent(page, timeoutMs = 20_000) {
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

export async function resolveAuthPageAfterSubmit(browser, page) {
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

export async function submitEmailOnce(authPage, emailHandle, progress = null) {
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

export function progressSafeFocus(handle) {
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

export async function findVisibleOtpInput(root) {
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

export async function waitForOtpInput(page, timeoutMs = 60_000, progress = null, label = "Waiting for code prompt") {
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

export async function waitForAuthEmailField(page, timeoutMs = 45_000) {
  return waitForEmailInput(page, timeoutMs);
}

export async function findVisibleInputMatching(root, hints) {
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

export async function pageShowsOnboardingProfile(page) {
  const hasCopy = await page.evaluate(() => {
    const text = document.body?.innerText?.replace(/\s+/g, " ").toLowerCase() ?? "";
    return text.includes("how old are you") || text.includes("full name");
  });
  if (!hasCopy) return false;
  const nameInput = await findVisibleInputMatching(page, ["name"]);
  const ageInput = await findVisibleInputMatching(page, ["age"]);
  return Boolean(nameInput && ageInput);
}

export async function fillInputValue(handle, page, value) {
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

export async function completeOnboardingProfile(page, progress, env) {
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


