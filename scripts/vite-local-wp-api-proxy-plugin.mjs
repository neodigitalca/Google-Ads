import { createRequire } from "node:module";
import http from "node:http";
import https from "node:https";
import {
  dataForSeoAuthConfigError,
  handleDataForSeoLlmResponsesLive,
  isLlmResponsesLiveRequest,
  resolveDataForSeoAuthFromRequest,
} from "./dataforseo-llm-responses-direct.mjs";
import {
  handleOpenRouterModelsCatalog,
  isOpenRouterModelsCatalogRequest,
} from "./openrouter-models-direct.mjs";

const require = createRequire(import.meta.url);
const { resolveDevApiTarget, isLocalWpProxyTarget } = require("./resolve-dev-api-target.cjs");

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function upstreamRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers: options.headers,
        rejectUnauthorized: parsed.protocol === "https:" ? false : undefined,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    if (body?.length) req.write(body);
    req.end();
  });
}

function isTransientProxyTransportError(message) {
  const m = String(message ?? "").toLowerCase();
  return (
    m.includes("unexpected eof") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("curl error 56") ||
    m.includes("ssl_read")
  );
}

async function fetchUpstream(url, options, body, targetOrigin, redirectsLeft = 5) {
  let response;
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await upstreamRequest(url, options, body);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= 2 || !isTransientProxyTransportError(error instanceof Error ? error.message : error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!response) {
    throw lastError ?? new Error("Local API proxy failed");
  }
  const status = response.status;
  if (redirectsLeft <= 0 || status < 300 || status >= 400) {
    return response;
  }

  const locationRaw = response.headers.location;
  if (!locationRaw) {
    return response;
  }

  const nextUrl = new URL(Array.isArray(locationRaw) ? locationRaw[0] : locationRaw, url);
  const targetHost = new URL(targetOrigin).host;
  if (nextUrl.host !== targetHost) {
    return response;
  }

  const nextOrigin = `${nextUrl.protocol}//${nextUrl.host}`;
  const nextHeaders = { ...options.headers, host: nextUrl.host };
  return fetchUpstream(
    nextUrl.href,
    { ...options, method: "GET", headers: nextHeaders },
    undefined,
    nextOrigin,
    redirectsLeft - 1,
  );
}

/**
 * Proxy /api to local WP without exposing cross-origin redirects to the browser.
 */
export function localWpApiProxyPlugin() {
  return {
    name: "local-wp-api-proxy",
    enforce: "pre",
    configureServer(server) {
      const target = resolveDevApiTarget();
      if (!isLocalWpProxyTarget(target)) return;

      const targetOrigin = new URL(target).origin;

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const path = rawUrl.split("?")[0] ?? "";

        if (isOpenRouterModelsCatalogRequest(req.method ?? "GET", path)) {
          try {
            const result = await handleOpenRouterModelsCatalog(req);
            res.statusCode = result.status;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.end(JSON.stringify(result.json));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : "OpenRouter models request failed",
              }),
            );
          }
          return;
        }

        if (isLlmResponsesLiveRequest(req.method, path)) {
          try {
            const body =
              req.method && !["GET", "HEAD"].includes(req.method) ? await readRequestBody(req) : undefined;
            const bodyJson = body?.length ? JSON.parse(body.toString("utf8")) : {};
            const auth = resolveDataForSeoAuthFromRequest(req, bodyJson);
            if (!auth) {
              const err = dataForSeoAuthConfigError(req, bodyJson);
              res.statusCode = 401;
              res.setHeader("content-type", "application/json; charset=utf-8");
              res.end(JSON.stringify(err));
              return;
            }
            const result = await handleDataForSeoLlmResponsesLive(body, auth);
            res.statusCode = result.status;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify(result.json));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : "DataForSEO LLM request failed",
              }),
            );
          }
          return;
        }

        if (!path.startsWith("/api")) {
          next();
          return;
        }

        try {
          const body =
            req.method && !["GET", "HEAD"].includes(req.method) ? await readRequestBody(req) : undefined;

          const headers = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (value == null || key === "host" || key === "connection") continue;
            headers[key] = Array.isArray(value) ? value.join(", ") : value;
          }
          headers.host = new URL(targetOrigin).host;

          const upstream = await fetchUpstream(
            `${targetOrigin}${rawUrl}`,
            { method: req.method, headers },
            body?.length ? body : undefined,
            targetOrigin,
          );

          if (upstream.status === 504) {
            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.end(
              JSON.stringify({
                ok: false,
                success: false,
                error: "WordPress timed out",
                workflows: [],
                runs: [],
                tasks: [],
                rows: [],
              }),
            );
            return;
          }

          if (upstream.status >= 300 && upstream.status < 400) {
            const locationRaw = upstream.headers.location;
            const locationHref = locationRaw
              ? new URL(Array.isArray(locationRaw) ? locationRaw[0] : locationRaw, targetOrigin).href
              : "";
            const locationHost = locationHref ? new URL(locationHref).host : "";
            const targetHost = new URL(targetOrigin).host;
            if (locationHref && locationHost !== targetHost) {
              res.statusCode = upstream.status;
              res.setHeader("cache-control", "no-store");
              res.setHeader("location", locationHref);
              res.end();
              return;
            }
            res.statusCode = 502;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error: "Local API proxy blocked an upstream redirect. Retry with a trailing slash on the API path.",
              }),
            );
            return;
          }

          res.statusCode = upstream.status;
          res.setHeader("cache-control", "no-store");

          for (const [key, value] of Object.entries(upstream.headers)) {
            if (value == null) continue;
            const lower = key.toLowerCase();
            if (lower === "transfer-encoding" || lower === "connection") continue;
            if (lower === "location") continue;
            if (lower === "set-cookie") {
              const cookies = Array.isArray(value) ? value : [value];
              for (const cookie of cookies) {
                res.appendHeader(
                  key,
                  cookie.replace(/;\s*Domain=[^;]+/gi, "; Domain=localhost").replace(/;\s*Secure/gi, ""),
                );
              }
              continue;
            }
            res.setHeader(key, value);
          }

          res.end(upstream.body);
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : "Local API proxy failed",
            }),
          );
        }
      });
    },
  };
}
