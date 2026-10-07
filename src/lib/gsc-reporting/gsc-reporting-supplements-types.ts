export type GscReportingSupplementImage = {
  name: string;
  dataUrl: string;
};

export type GscReportingSupplementFiles = {
  localDominatorCsv?: string;
  localDominatorCsvName?: string;
  images: GscReportingSupplementImage[];
};

export function gscReportingSupplementsEmpty(): GscReportingSupplementFiles {
  return { images: [] };
}

export function gscReportingSupplementsHasContent(s: GscReportingSupplementFiles | undefined): boolean {
  if (!s) return false;
  if (s.localDominatorCsv?.trim()) return true;
  return s.images.some((img) => img.dataUrl.trim().length > 0);
}
