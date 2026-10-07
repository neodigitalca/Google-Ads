import path from "node:path";
import { fileURLToPath } from "node:url";
import { pollAgentMailOtp } from "./agentmail.mjs";
import {
  defaultChatGptUrl,
  gotoChatGpt,
  isComposerReady,
} from "./chatgpt-composer.mjs";
import {
  clearSessionFile as clearSessionFileAtPath,
  saveSessionCookies as saveSessionCookiesAtPath,
} from "../_shared/session-cookies.mjs";
import { resolveEnv } from "./lib-env.mjs";
import {
  clearBrowserCookies,
  completeOnboardingProfile,
  fillOtpOnAuthPage,
  pageShowsOnboardingProfile,
  submitOtpOnAuthPage,
  waitForAuthEmailField,
  waitForAuthLoginPage,
  waitForLoginButtonAndClick,
  waitForOtpInput,
  submitEmailOnce,
  isAuthLoginUrl,
} from "./chatgpt-login-ui.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionPath = path.join(__dirname, "..", "..", "..", ".chatgpt-audit-session.json");

async function saveSessionCookies(page) {
  return saveSessionCookiesAtPath(page, sessionPath);
}
function clearSessionFile() {
  clearSessionFileAtPath(sessionPath);
}

const NEW_CHAT_POLL_INTERVAL_MS = 1_500;

export async function waitWithProgressScreenshots(page, progress, label, totalMs) {
  if (page && progress && totalMs > 0) {
    await progress.screenshot(page, label, { force: true });
  }
  if (totalMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, totalMs));
  }
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
