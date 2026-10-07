import https from "node:https";
import { normalizeOpenRouterModelsPayload } from "./openrouter-models-catalog-normalize.mjs";

const presetIds = process.argv.slice(2);
if (presetIds.length === 0) {
  console.error("Usage: node scripts/print-preset-openrouter-prices.mjs <model-id> ...");
  process.exit(1);
}

function fetchModels() {
  return new Promise((resolve, reject) => {
    https
      .get(
        "https://openrouter.ai/api/v1/models",
        {
          headers: {
            "HTTP-Referer": "https://neodigital.ca/neo-pulse/",
            "X-Title": "NEO Pulse Web App",
          },
        },
        (res) => {
          let body = "";
          res.on("data", (c) => {
            body += c;
          });
          res.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(e);
            }
          });
        },
      )
      .on("error", reject);
  });
}

function priceHint(entry) {
  if (!entry) return null;
  const pin =
    entry.promptUsdPerToken != null ? `$${(entry.promptUsdPerToken * 1_000_000).toFixed(2)}` : null;
  const pout =
    entry.completionUsdPerToken != null
      ? `$${(entry.completionUsdPerToken * 1_000_000).toFixed(2)}`
      : null;
  if (pin && pout) return `${pin} / ${pout} per 1M in/out`;
  if (pin) return `${pin} per 1M in`;
  if (pout) return `${pout} per 1M out`;
  return null;
}

const raw = await fetchModels();
const models = normalizeOpenRouterModelsPayload(raw);
for (const id of presetIds) {
  const entry = models.find((m) => m.id === id);
  console.log(`${id}\t${priceHint(entry) ?? "MISSING"}`);
}
