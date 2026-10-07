import fs from "node:fs";

export function readNewQueryEntries(queriesPath, processedIds) {
  if (!queriesPath || !fs.existsSync(queriesPath)) return [];
  const lines = fs.readFileSync(queriesPath, "utf8").split(/\r?\n/).filter(Boolean);
  /** @type {Array<{ id: string, text: string, enqueuedAt?: string }>} */
  const fresh = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const id = String(entry?.id ?? "").trim();
      const text = String(entry?.text ?? "").trim();
      if (!id || !text || processedIds.has(id)) continue;
      fresh.push({
        id,
        text,
        clientUrl: String(entry?.clientUrl ?? "").trim(),
        enqueuedAt: entry.enqueuedAt,
      });
    } catch {
      // ignore bad lines
    }
  }
  return fresh;
}

export function readControlPayload(controlPath) {
  if (!controlPath || !fs.existsSync(controlPath)) {
    return { action: "", clientUrl: "" };
  }
  try {
    const data = JSON.parse(fs.readFileSync(controlPath, "utf8"));
    return {
      action: String(data?.action ?? "").trim().toLowerCase(),
      clientUrl: String(data?.clientUrl ?? "").trim(),
    };
  } catch {
    return { action: "", clientUrl: "" };
  }
}

export function readControlAction(controlPath) {
  return readControlPayload(controlPath).action;
}

export function clearControlFile(controlPath) {
  if (controlPath && fs.existsSync(controlPath)) {
    fs.unlinkSync(controlPath);
  }
}

export function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
