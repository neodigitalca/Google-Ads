import {
  handleDataForSeoLlmResponsesLive,
  isLlmResponsesLiveRequest,
  resolveDataForSeoAuthFromRequest,
} from "./dataforseo-llm-responses-direct.mjs";

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Fallback when local WP proxy plugin is off; localWpApiProxyPlugin handles this path first when enabled. */
export function dataforseoLlmResponsesDevPlugin() {
  return {
    name: "dataforseo-llm-responses-dev",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "").split("?")[0] ?? "";
        if (!isLlmResponsesLiveRequest(req.method, path)) {
          next();
          return;
        }
        try {
          const raw = await readRequestBody(req);
          const bodyJson = raw?.length ? JSON.parse(raw.toString("utf8")) : {};
          const auth = resolveDataForSeoAuthFromRequest(req, bodyJson);
          if (!auth) {
            res.statusCode = 401;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: "DataForSEO API key required",
                hint: "Save your DataForSEO login:password in Dashboard → Settings → DataForSEO, then retry.",
              }),
            );
            return;
          }
          const result = await handleDataForSeoLlmResponsesLive(raw, auth);
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
      });
    },
  };
}
