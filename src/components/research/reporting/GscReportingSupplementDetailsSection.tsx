import type { ReactElement } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import { gscReportingSupplementsHasContent } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import { WorkspaceDetailsSection } from "@/components/shared/WorkspaceDetailsStack";

export type GscReportingSupplementDetailsSectionProps = {
  busy: boolean;
  supplements: GscReportingSupplementFiles;
  onSupplementsChange: (next: GscReportingSupplementFiles) => void;
  stripeIndex: number;
};

export function GscReportingSupplementDetailsSection({
  busy,
  supplements,
  onSupplementsChange,
  stripeIndex,
}: GscReportingSupplementDetailsSectionProps): ReactElement | null {
  if (!gscReportingSupplementsHasContent(supplements)) return null;

  const clearCsv = () => {
    onSupplementsChange({
      ...supplements,
      localDominatorCsv: undefined,
      localDominatorCsvName: undefined,
    });
  };

  const removeImage = (index: number) => {
    onSupplementsChange({
      ...supplements,
      images: supplements.images.filter((_, j) => j !== index),
    });
  };

  return (
    <WorkspaceDetailsSection title="Local insights files" stripeIndex={stripeIndex} defaultOpen>
      {supplements.localDominatorCsv?.trim() ? (
        <div className="flex min-h-9 w-full items-center gap-3 border-0 px-2.5 py-1.5 sm:px-3">
          <span className="shrink-0 text-base text-muted-foreground">CSV</span>
          <span className="min-w-0 flex-1 truncate text-base text-white">
            {supplements.localDominatorCsvName?.trim() || "Attached CSV"}
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 shrink-0 px-2 text-muted-foreground hover:text-white"
            disabled={busy}
            aria-label="Remove CSV"
            onClick={clearCsv}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}
      {supplements.images.map((img, index) => (
        <div
          key={`${img.name}-${index}`}
          className="flex min-h-[4.5rem] w-full items-center gap-3 border-0 px-2.5 py-1.5 sm:px-3"
        >
          {img.dataUrl.startsWith("data:image/") ? (
            <img
              src={img.dataUrl}
              alt=""
              className="h-14 w-14 shrink-0 object-cover bg-zinc-900"
              width={56}
              height={56}
            />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center bg-zinc-900 text-base text-muted-foreground">
              File
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-base text-foreground">{img.name}</span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 shrink-0 px-2 text-muted-foreground hover:text-white"
            disabled={busy}
            aria-label={`Remove ${img.name}`}
            onClick={() => removeImage(index)}
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ))}
    </WorkspaceDetailsSection>
  );
}
