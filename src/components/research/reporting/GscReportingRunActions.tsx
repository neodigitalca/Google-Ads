import { ClipboardList, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BULK_HEADER_ICON_RUN_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { cn } from "@/lib/utils";

export type GscReportingRunActionsProps = {
  busy: boolean;
  canClear: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onClear: () => void;
};

const RUN_ACTIONS_SLOT_CLASS = "h-8 w-8 shrink-0 p-0";

export function GscReportingRunActions({
  busy,
  canClear,
  onGenerate,
  onCancel,
  onClear,
}: GscReportingRunActionsProps) {
  return (
    <div
      className="ml-auto flex w-[4.375rem] shrink-0 flex-nowrap items-center gap-1.5"
      role="group"
      aria-label="Generate report"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !canClear}
        className={cn(
          RUN_ACTIONS_SLOT_CLASS,
          "border border-red-600/70 bg-black text-red-500 hover:bg-red-950/50 disabled:opacity-40",
        )}
        aria-label="Clear report"
        title="Clear report"
        onClick={onClear}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      {busy ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            RUN_ACTIONS_SLOT_CLASS,
            "border border-red-600/70 bg-black text-red-500 hover:bg-red-950/50",
          )}
          aria-label="Cancel"
          title="Cancel"
          onClick={onCancel}
        >
          <Square className="h-4 w-4" aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          className={cn(BULK_HEADER_ICON_RUN_BTN, RUN_ACTIONS_SLOT_CLASS)}
          aria-label="Generate report"
          title="Generate report"
          onClick={onGenerate}
        >
          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      )}
    </div>
  );
}
