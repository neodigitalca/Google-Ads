export function slugFromPath(apiPath) {
  return apiPath.replace(/\{[^}]+\}/g, (m) => m.slice(1, -1)).replace(/\//g, "/");
}

export function fileSlug(apiPath) {
  return apiPath
    .replace(/\{teamId\}/g, "")
    .replace(/\{[^}]+\}/g, (m) => `by-${m.slice(1, -1)}`)
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "")
    .replace(/\//g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function titleFromSegment(seg) {
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function titleFromPath(apiPath, method) {
  const parts = apiPath.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? apiPath;
  if (last.includes("{")) return `${method} ${apiPath}`;
  return titleFromSegment(last.replace(/\.[^.]+$/, ""));
}
