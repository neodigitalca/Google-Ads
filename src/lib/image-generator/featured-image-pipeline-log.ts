const PREFIX = "[Featured Image Pipeline]";

export function logFeaturedImagePipeline(
  message: string,
  details?: Record<string, unknown>,
): void {
  if (typeof console === "undefined" || typeof console.log !== "function") return;
  if (details && Object.keys(details).length > 0) {
    console.log(`${PREFIX} ${message}`, details);
  } else {
    console.log(`${PREFIX} ${message}`);
  }
}
