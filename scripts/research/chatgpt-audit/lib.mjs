import {
  enableChatGptLeanBrowsing,
  shouldAbortChatGptProxyRequest,
} from "./chatgpt-lean-browsing.mjs";
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
import {
  composeChatGptAuditPrompt as composeChatGptAuditPromptCore,
  generateOnboardingProfile as generateOnboardingProfileCore,
  pickOpenRouterKey,
} from "./openrouter-chatgpt-audit.mjs";
import {
  defaultChatGptUrl,
  gotoChatGpt,
  isComposerReady,
  isLoggedIn,
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
import {
  repoRoot,
  envPath,
  sessionPath,
  defaultAgentMailInbox,
  loadEnv,
  resolveEnv,
  requireEnv,
} from "./lib-env.mjs";
import { waitWithProgressScreenshots, loginChatGpt } from "./chatgpt-login.mjs";

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
};
export {
  repoRoot,
  envPath,
  sessionPath,
  defaultAgentMailInbox,
  loadEnv,
  resolveEnv,
  requireEnv,
  waitWithProgressScreenshots,
  loginChatGpt,
};

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

export async function composeChatGptAuditPrompt(input, env = resolveEnv()) {
  return composeChatGptAuditPromptCore(input, env);
}

export async function generateOnboardingProfile(env = resolveEnv()) {
  return generateOnboardingProfileCore(env);
}

export function createProgressWriter(progressPath) {
  return createSharedProgressWriter(progressPath, {
    minScreenshotIntervalMs: 4_000,
    useCaptureHelper: true,
    includeWrite: true,
  });
}
