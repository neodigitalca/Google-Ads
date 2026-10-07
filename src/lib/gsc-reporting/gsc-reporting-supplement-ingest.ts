import type { GscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";

function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || file.type === "text/csv";
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function ingestGscReportingSupplementFiles(
  fileList: FileList | File[],
  current: GscReportingSupplementFiles,
): Promise<GscReportingSupplementFiles> {
  const files = Array.from(fileList);
  if (files.length === 0) return current;

  let next: GscReportingSupplementFiles = {
    localDominatorCsv: current.localDominatorCsv,
    localDominatorCsvName: current.localDominatorCsvName,
    images: [...current.images],
  };

  for (const file of files) {
    if (isCsvFile(file)) {
      next = {
        ...next,
        localDominatorCsv: await readFileAsText(file),
        localDominatorCsvName: file.name,
      };
      continue;
    }
    const dataUrl = await readFileAsDataUrl(file);
    next = {
      ...next,
      images: [...next.images, { name: file.name, dataUrl }],
    };
  }

  return next;
}
