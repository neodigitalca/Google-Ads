import React, { useCallback, useRef } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { GscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplements-types";
import { ingestGscReportingSupplementFiles } from "@/lib/gsc-reporting/gsc-reporting-supplement-ingest";
import { cn } from "@/lib/utils";

export type GscReportingSupplementUploadProps = {
  busy: boolean;
  value: GscReportingSupplementFiles;
  onChange: (next: GscReportingSupplementFiles) => void;
};

export function GscReportingSupplementUpload({
  busy,
  value,
  onChange,
}: GscReportingSupplementUploadProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const next = await ingestGscReportingSupplementFiles(fileList, value);
      onChange(next);
    },
    [onChange, value],
  );

  return (
    <>
      <Button
        type="button"
        className={cn(BULK_HEADER_TOOL_BTN, "h-8 w-8 shrink-0 justify-center px-0")}
        disabled={busy}
        aria-label="Add files for local insights"
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files).catch(() => undefined);
          e.target.value = "";
        }}
      />
    </>
  );
}
