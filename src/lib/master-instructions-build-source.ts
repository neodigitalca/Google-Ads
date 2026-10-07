import type { MasterInstructionSource } from "@/lib/master-instructions-storage";
import {
  shouldStoreInstructionVerbatim,
  summarizeInstructionDocumentForMasterPrompt,
} from "@/lib/master-instructions-openrouter-summarize";

export function upsertMasterInstructionSource(
  sources: MasterInstructionSource[],
  row: MasterInstructionSource,
): MasterInstructionSource[] {
  const index = sources.findIndex((s) => s.name === row.name);
  if (index >= 0) {
    const next = [...sources];
    next[index] = row;
    return next;
  }
  return [...sources, row];
}

/**
 * Same contract as file upload: short text verbatim, longer text via nested triples.
 */
export async function buildMasterInstructionSourceFromPlainText(
  plainText: string,
  options: { siteId: string; fileName: string },
): Promise<MasterInstructionSource> {
  const extracted = plainText.trim();
  if (!extracted) {
    throw new Error("No text to save.");
  }
  const verbatim = shouldStoreInstructionVerbatim(extracted);
  const content = verbatim
    ? extracted
    : await summarizeInstructionDocumentForMasterPrompt(extracted, options);
  if (!content.trim()) {
    throw new Error("Summary was empty. Try again or use a different document.");
  }
  return {
    name: options.fileName,
    content,
    uploadedAt: Date.now(),
    ...(verbatim ? {} : { kind: "semantic-triples" as const, originalExtractedChars: extracted.length }),
  };
}
