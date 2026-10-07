/** Escape and wrap plain master-rule text for TipTap HTML content. */
export function plainTextToEditorHtml(plain: string): string {
  const t = plain.trim();
  if (!t) return "";
  const escaped = t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n\n+/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
