export function sanitizeGoogleDriveDocumentTitle(title: string): string {
  return title
    .replace(/[/\\?*:|"<>#]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
