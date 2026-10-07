import type { ImageGenerationResponse } from "@/lib/image-api";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickUrlLike(value: unknown): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    if (
      t.startsWith("http://") ||
      t.startsWith("https://") ||
      t.startsWith("data:image/")
    ) {
      return t;
    }
    return null;
  }
  const obj = asRecord(value);
  if (!obj) return null;
  for (const key of ["url", "image_url", "href"]) {
    const nested = obj[key];
    if (typeof nested === "string") {
      const picked = pickUrlLike(nested);
      if (picked) return picked;
    }
    if (nested && typeof nested === "object") {
      const picked = pickUrlLike(nested);
      if (picked) return picked;
    }
  }
  return null;
}

function pickFromPart(part: unknown): ImageGenerationResponse | null {
  const obj = asRecord(part);
  if (!obj) return null;

  const b64 =
    (typeof obj.b64_json === "string" && obj.b64_json) ||
    (typeof obj.base64 === "string" && obj.base64) ||
    null;
  if (b64) {
    const base64String = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
    return { imageBase64: base64String };
  }

  const inline = asRecord(obj.inlineData);
  if (inline && typeof inline.data === "string" && inline.data.trim()) {
    const mime = typeof inline.mimeType === "string" ? inline.mimeType : "image/png";
    return { imageBase64: `data:${mime};base64,${inline.data.trim()}` };
  }

  for (const key of ["image_url", "url", "image"]) {
    const picked = pickUrlLike(obj[key]);
    if (picked) {
      return picked.startsWith("data:") ? { imageBase64: picked } : { imageUrl: picked };
    }
  }

  if (obj.type === "image_url" || obj.type === "image") {
    const picked = pickUrlLike(obj.image_url ?? obj.url ?? obj.image);
    if (picked) {
      return picked.startsWith("data:") ? { imageBase64: picked } : { imageUrl: picked };
    }
  }

  return null;
}

/** Extract generated image bytes/URL from an OpenRouter assistant message. */
export function extractImageFromOpenRouterAssistantMessage(
  message: unknown,
): ImageGenerationResponse | null {
  const msg = asRecord(message);
  if (!msg) return null;

  const images = msg.images;
  if (Array.isArray(images)) {
    for (const row of images) {
      const picked = pickFromPart(row);
      if (picked) return picked;
    }
  }

  const content = msg.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const picked = pickFromPart(part);
      if (picked) return picked;
    }
  }

  for (const key of ["image_url", "url", "b64_json", "image"]) {
    const picked = pickFromPart({ [key]: msg[key] });
    if (picked) return picked;
  }

  return null;
}
