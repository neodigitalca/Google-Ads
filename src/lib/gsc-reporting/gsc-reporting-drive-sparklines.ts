import { uploadDeliverableToDrive } from "@/lib/google-drive/upload-deliverable-to-drive";
import type { TaskArchiveFileInput } from "@/lib/task-execution-archive";

type DriveDeliverable = {
  fileName: string;
  content: string;
  mime: string;
  convertToGoogleDoc: boolean;
};

export function driveViewUrlForFileId(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId.trim())}`;
}

export function rewriteSparklinePlaceholdersInMarkdown(
  markdown: string,
  urlByFileName: Map<string, string>,
): string {
  return markdown.replace(/!\[([^\]]*)\]\(sparkline:([^)]+)\)/g, (full, alt: string, fileName: string) => {
    const url = urlByFileName.get(fileName.trim());
    if (!url) return full;
    return `![${alt}](${url})`;
  });
}

export async function embedGscSparklinesInDeliverables(args: {
  deliverables: DriveDeliverable[];
  archiveFiles?: TaskArchiveFileInput[];
  folderId: string;
}): Promise<DriveDeliverable[]> {
  const sparklines = (args.archiveFiles ?? []).filter(
    (f) => f.fileName.startsWith("gsc-sparkline-") && f.fileName.endsWith(".svg") && f.content.trim(),
  );
  if (sparklines.length === 0) return args.deliverables;

  const urlByName = new Map<string, string>();
  for (const file of sparklines) {
    const upload = await uploadDeliverableToDrive({
      fileName: file.fileName,
      content: file.content,
      folderId: args.folderId,
      mime: "image/svg+xml",
      convertToGoogleDoc: false,
    });
    if (upload.success && upload.fileId) {
      urlByName.set(file.fileName, driveViewUrlForFileId(upload.fileId));
    }
  }
  if (urlByName.size === 0) return args.deliverables;

  return args.deliverables.map((d) => {
    if (!d.content.includes("sparkline:")) return d;
    return {
      ...d,
      content: rewriteSparklinePlaceholdersInMarkdown(d.content, urlByName),
    };
  });
}
