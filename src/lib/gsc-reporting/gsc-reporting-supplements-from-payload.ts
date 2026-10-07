import type { GscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function gscReportingSupplementsFromExecutionPayload(
  payload?: TaskExecutionPayload | Record<string, unknown> | null,
): GscReportingSupplementFiles | undefined {
  const p = (payload ?? {}) as TaskExecutionPayload;
  const csvB64 = typeof p.localDominatorCsvBase64 === "string" ? p.localDominatorCsvBase64.trim() : "";
  let localDominatorCsv: string | undefined;
  if (csvB64) {
    try {
      localDominatorCsv = decodeBase64Utf8(csvB64);
    } catch {
      localDominatorCsv = undefined;
    }
  }

  const images: GscReportingSupplementFiles["images"] = [];
  for (const row of p.localInsightsImages ?? []) {
    const fileName = String(row.fileName ?? "").trim() || "screenshot";
    const mime = String(row.mime ?? "image/png").trim() || "image/png";
    const contentBase64 = String(row.contentBase64 ?? "").trim();
    if (!contentBase64) continue;
    images.push({
      name: fileName,
      dataUrl: `data:${mime};base64,${contentBase64}`,
    });
  }

  if (!localDominatorCsv?.trim() && images.length === 0) return undefined;
  return { localDominatorCsv, images };
}
