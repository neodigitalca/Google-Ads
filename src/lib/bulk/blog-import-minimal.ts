import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";

/** Details drawer: two slots only (content HTML + upload proof JSON). */
export const BLOG_IMPORT_PIPELINE_TITLES = ["Post content", "Upload JSON"] as const;

export function isBlogImportArtifactFile(file: Pick<BulkGeneratedFile, "fileName">): boolean {
  const name = file.fileName.toLowerCase();
  return (
    name.startsWith("content-") ||
    name.startsWith("wordpress-post-") ||
    name.startsWith("blog-import-meta-")
  );
}

export function filterBlogImportRowFiles(files: BulkGeneratedFile[]): BulkGeneratedFile[] {
  return files.filter(isBlogImportArtifactFile);
}
