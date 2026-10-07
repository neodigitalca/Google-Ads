import fs from "node:fs";

/**
 * @param {string} sessionPath
 */
export function readSessionFile(sessionPath) {
  if (!fs.existsSync(sessionPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
    if (Array.isArray(parsed)) {
      return { savedAt: null, cookies: parsed };
    }
    if (parsed && Array.isArray(parsed.cookies)) {
      return {
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
        cookies: parsed.cookies,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** @param {string} sessionPath */
export function clearSessionFile(sessionPath) {
  if (fs.existsSync(sessionPath)) {
    fs.unlinkSync(sessionPath);
  }
}

/** @param {import("puppeteer").Protocol.Network.Cookie[]} cookies @param {string | null} savedAt */
export function sessionCookiesAreStale(cookies, savedAt) {
  const nowSec = Date.now() / 1000;
  for (const cookie of cookies) {
    const expires = Number(cookie?.expires ?? 0);
    if (expires > 0 && expires < nowSec) {
      return true;
    }
  }
  if (savedAt) {
    const savedMs = Date.parse(savedAt);
    if (Number.isFinite(savedMs) && Date.now() - savedMs > 7 * 24 * 60 * 60 * 1000) {
      return true;
    }
  }
  return false;
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} sessionPath
 */
export async function applySessionCookies(page, sessionPath) {
  const session = readSessionFile(sessionPath);
  if (!session?.cookies?.length) return false;
  if (sessionCookiesAreStale(session.cookies, session.savedAt)) {
    clearSessionFile(sessionPath);
    return false;
  }
  await page.setCookie(...session.cookies);
  return true;
}

/**
 * @param {import("puppeteer").Page} page
 * @param {string} sessionPath
 */
export async function saveSessionCookies(page, sessionPath) {
  const cookies = await page.cookies();
  const payload = {
    savedAt: new Date().toISOString(),
    cookies,
  };
  fs.writeFileSync(sessionPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
