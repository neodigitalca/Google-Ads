import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONFIG_PATHS = [
  path.join(ROOT, "scripts", "local-wp-staging.config.json"),
  path.join(ROOT, "scripts", "local-wp-staging.config.example.json"),
];

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const WEBMASTERS = "https://www.googleapis.com/webmasters/v3";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

function loadLocalConfig() {
  for (const configPath of CONFIG_PATHS) {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  }
  return {};
}

function gscCredentialsPath() {
  const local = loadLocalConfig();
  const wpRoot = String(local.wpRoot || "").trim();
  if (!wpRoot) return "";
  return path.join(wpRoot, "wp-content", "uploads", "neo-pulse-data", "gsc-service-account.json");
}

function loadServiceAccount() {
  const credPath = gscCredentialsPath();
  if (!credPath || !fs.existsSync(credPath)) {
    throw new Error("GSC service account JSON is not configured.");
  }
  const data = JSON.parse(fs.readFileSync(credPath, "utf8"));
  const email = String(data.client_email || "").trim();
  let key = String(data.private_key || "");
  key = key.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("GSC service account JSON must include client_email and private_key.");
  }
  return { client_email: email, private_key: key };
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildJwt(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );
  const input = `${header}.${claim}`;
  const sign = createSign("RSA-SHA256");
  sign.update(input);
  sign.end();
  const sig = sign.sign(privateKey);
  return `${input}.${sig.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

function httpsJson(url, options, bodyPayload) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload =
      bodyPayload == null
        ? undefined
        : typeof bodyPayload === "string"
          ? bodyPayload
          : JSON.stringify(bodyPayload);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method || "GET",
        headers: {
          ...(options.headers || {}),
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let json;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode ?? 502, json, raw });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function getAccessToken(creds) {
  const jwt = buildJwt(creds.client_email, creds.private_key);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  }).toString();
  const tokenRes = await httpsJson(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  }, body);
  if (tokenRes.status < 200 || tokenRes.status >= 300 || !tokenRes.json?.access_token) {
    const msg = tokenRes.json?.error_description || tokenRes.json?.error || `Token HTTP ${tokenRes.status}`;
    throw new Error(msg);
  }
  return tokenRes.json.access_token;
}

function requestedDomain(siteUrl) {
  const normalized = String(siteUrl || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const domain = normalized.split("/")[0] || "";
  return domain.replace(/^www\./, "");
}

function propertyDomain(propertyUrl) {
  const raw = String(propertyUrl || "").trim();
  if (/^sc-domain:/i.test(raw)) {
    return raw.replace(/^sc-domain:\s*/i, "").replace(/^www\./, "").toLowerCase();
  }
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function listSites(token) {
  const res = await httpsJson(`${WEBMASTERS}/sites`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status < 200 || res.status >= 300) {
    const msg = res.json?.error?.message || res.raw?.slice(0, 200) || `Sites HTTP ${res.status}`;
    throw new Error(msg);
  }
  const entries = Array.isArray(res.json?.siteEntry) ? res.json.siteEntry : [];
  return entries.map((s) => String(s.siteUrl || "")).filter(Boolean);
}

function validateDates(startDate, endDate) {
  const start = String(startDate || "").trim();
  const end = String(endDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    throw new Error("Dates must be in YYYY-MM-DD format");
  }
  if (start >= end) {
    throw new Error("startDate must be before endDate");
  }
  return { startDate: start, endDate: end };
}

function defaultDateRange() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() - 3);
  const startDate = new Date(endDate);
  startDate.setMonth(endDate.getMonth() - 3);
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: fmt(startDate), endDate: fmt(endDate) };
}

/**
 * Local dev: one GSC property, one Search Analytics query. No retries.
 */
export async function handleGscDevFetchQueries(body) {
  const siteUrl = String(body?.siteUrl || "").trim();
  if (!siteUrl) {
    return { status: 400, json: { success: false, error: "Missing required field: siteUrl" } };
  }

  const range =
    body?.startDate && body?.endDate
      ? validateDates(body.startDate, body.endDate)
      : defaultDateRange();

  const rowLimitParsed = Number(body?.rowLimit);
  const rowLimit = Math.min(10000, Math.max(1, Number.isFinite(rowLimitParsed) && rowLimitParsed > 0 ? rowLimitParsed : 500));

  const creds = loadServiceAccount();
  const token = await getAccessToken(creds);
  const resolved = await resolveGscPropertyForSite(token, siteUrl, creds);
  if (!resolved.ok) {
    const sites = await listSites(token);
    const wanted = requestedDomain(siteUrl);
    return {
      status: 200,
      json: {
        ...resolved.json,
        error: `This site is not in the list of properties the service account can access (${wanted}).`,
        requestedDomain: wanted,
        accessiblePropertyCount: sites.length,
        accessiblePropertiesPreview: sites.slice(0, 40),
        dateRange: { start: range.startDate, end: range.endDate },
      },
    };
  }
  const property = resolved.property;

  const encoded = encodeURIComponent(property);
  const analyticsBody = {
    startDate: range.startDate,
    endDate: range.endDate,
    dimensions: ["query"],
    rowLimit,
    startRow: 0,
  };
  const res = await httpsJson(
    `${WEBMASTERS}/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
    analyticsBody,
  );

  if (res.status < 200 || res.status >= 300) {
    const msg = res.json?.error?.message || res.raw?.slice(0, 300) || `Search Analytics HTTP ${res.status}`;
    return {
      status: res.status,
      json: {
        success: false,
        error: msg,
        errorType: res.status === 403 ? "access_denied" : res.status === 404 ? "property_not_found" : "api_error",
        property,
        originalSiteUrl: siteUrl,
        serviceAccountEmail: creds.client_email,
        dateRange: { start: range.startDate, end: range.endDate },
      },
    };
  }

  const rows = Array.isArray(res.json?.rows) ? res.json.rows : [];
  const queries = rows.map((row) => ({
    query: String(row.keys?.[0] || ""),
    clicks: Number(row.clicks) || 0,
    impressions: Number(row.impressions) || 0,
    ctr: Number(row.ctr) || 0,
    position: Number(row.position) || 0,
    date: `${range.startDate} to ${range.endDate}`,
  }));

  return {
    status: 200,
    json: {
      success: true,
      queries,
      property,
      propertyFormat: property.startsWith("sc-domain:") ? "domain" : "url-prefix",
      dateRange: { start: range.startDate, end: range.endDate },
      ...(queries.length === 0 ? { message: "No search queries found for the specified date range" } : {}),
    },
  };
}

async function resolveGscPropertyForSite(token, siteUrl, creds) {
  const sites = await listSites(token);
  const wanted = requestedDomain(siteUrl);
  const property = sites.find((s) => propertyDomain(s) === wanted);
  if (!property) {
    return {
      ok: false,
      json: {
        success: false,
        errorType: "site_not_in_list",
        error: `Add ${creds.client_email} in GSC for this property.`,
        originalSiteUrl: siteUrl,
        serviceAccountEmail: creds.client_email,
      },
    };
  }
  return { ok: true, property };
}

/**
 * Local dev: daily Search Analytics for up to 3 filtered queries (reporting sparklines).
 */
export async function handleGscDevQueryDailySeries(body) {
  const siteUrl = String(body?.siteUrl || "").trim();
  if (!siteUrl) {
    return { status: 400, json: { success: false, error: "Missing required field: siteUrl" } };
  }
  if (!body?.startDate || !body?.endDate) {
    return { status: 400, json: { success: false, error: "startDate and endDate required" } };
  }

  let range;
  try {
    range = validateDates(body.startDate, body.endDate);
  } catch (error) {
    return {
      status: 400,
      json: { success: false, error: error instanceof Error ? error.message : "Invalid date range" },
    };
  }

  const queries = Array.isArray(body?.queries)
    ? body.queries
        .map((q) => (typeof q === "string" ? q.trim() : ""))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (queries.length === 0) {
    return { status: 400, json: { success: false, error: "queries array is required" } };
  }

  const creds = loadServiceAccount();
  const token = await getAccessToken(creds);
  const resolved = await resolveGscPropertyForSite(token, siteUrl, creds);
  if (!resolved.ok) {
    return { status: 200, json: resolved.json };
  }
  const property = resolved.property;
  const encoded = encodeURIComponent(property);

  const series = [];
  for (const query of queries) {
    const res = await httpsJson(
      `${WEBMASTERS}/sites/${encoded}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
      {
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ["date"],
        rowLimit: 25000,
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: "query",
                operator: "equals",
                expression: query,
              },
            ],
          },
        ],
      },
    );

    if (res.status < 200 || res.status >= 300) {
      const msg = res.json?.error?.message || res.raw?.slice(0, 300) || `Search Analytics HTTP ${res.status}`;
      return { status: 500, json: { success: false, error: msg } };
    }

    const rows = Array.isArray(res.json?.rows) ? res.json.rows : [];
    const days = rows
      .map((row) => {
        const date = String(row.keys?.[0] || "");
        if (!date) return null;
        return {
          date,
          clicks: Number(row.clicks) || 0,
          impressions: Number(row.impressions) || 0,
          position: Number(row.position) || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));

    series.push({ query, days });
  }

  return {
    status: 200,
    json: {
      success: true,
      property,
      startDate: range.startDate,
      endDate: range.endDate,
      series,
    },
  };
}

export function isGscFetchQueriesPath(pathname) {
  return pathname === "/api/gsc/fetch-queries" || pathname === "/api/gsc/fetch-queries/";
}

export function isGscQueryDailySeriesPath(pathname) {
  return pathname === "/api/gsc/query-daily-series" || pathname === "/api/gsc/query-daily-series/";
}

export function isGscDevDirectApiPath(pathname) {
  return isGscFetchQueriesPath(pathname) || isGscQueryDailySeriesPath(pathname);
}
