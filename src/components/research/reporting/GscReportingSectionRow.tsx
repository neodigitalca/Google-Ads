import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { contentOptimizerRowStripeClass } from "@/components/overview/overview-tab/overview-tab-content-constants";
import { cn } from "@/lib/utils";

const ROW_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,auto)] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);

const ROW_ACTIONS_CLASS = "flex shrink-0 flex-nowrap items-center justify-end gap-1 sm:gap-2";

export type GscReportingSectionRowProps = {
  stripeIndex: number;
  index: number;
  planId: string;
  h2Title: string;
  statusLabel: string;
  generating: boolean;
  done: boolean;
  onDownloadMd: () => void;
  onDownloadPostJson: () => void;
};

export function GscReportingSectionRow({
  stripeIndex,
  index,
  planId,
  h2Title,
  statusLabel,
  generating,
  done,
  onDownloadMd,
  onDownloadPostJson,
}: GscReportingSectionRowProps) {
  return (
    <div className={cn("w-full", contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize: generating }))}>
      <div className={ROW_GRID_CLASS}>
        <div className="flex shrink-0 items-center justify-center">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          ) : done ? (
            <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
          ) : (
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-medium text-foreground">
            <span className="text-muted-foreground">{index + 1}. </span>
            {h2Title}
          </div>
          <div className="truncate text-base text-muted-foreground">
            {planId} · {statusLabel}
          </div>
        </div>
        <div className={ROW_ACTIONS_CLASS}>
          {done ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(BULK_HEADER_TOOL_BTN, "h-8 shrink-0 gap-1 px-2")}
                title="Download this section Markdown"
                onClick={onDownloadMd}
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                .md
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-8 min-h-0 shrink-0 p-0 text-base font-semibold leading-snug text-[hsl(var(--semantic-data))] underline underline-offset-2"
                title="OpenRouter POST JSON for this section"
                onClick={onDownloadPostJson}
              >
                POST .json
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
