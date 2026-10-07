import {
  handleGscDevFetchQueries,
  handleGscDevQueryDailySeries,
  isGscDevDirectApiPath,
  isGscQueryDailySeriesPath,
} from "./gsc-dev-fetch-queries.mjs";

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Local dev: selected POST /api/gsc/* routes hit Google directly (service account file), not WordPress.
 */
export function gscFetchQueriesDevPlugin() {
  return {
    name: "gsc-direct-dev-api",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0] ?? "";
        if (req.method !== "POST" || !isGscDevDirectApiPath(pathname)) {
          next();
          return;
        }

        try {
          const raw = await readRequestBody(req);
          const body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
          const result = isGscQueryDailySeriesPath(pathname)
            ? await handleGscDevQueryDailySeries(body)
            : await handleGscDevFetchQueries(body);
          res.statusCode = result.status;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.setHeader("cache-control", "no-store");
          res.end(JSON.stringify(result.json));
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "GSC request failed",
              errorType: "api_error",
            }),
          );
        }
      });
    },
  };
}
