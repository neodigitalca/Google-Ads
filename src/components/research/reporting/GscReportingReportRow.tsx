import { Copy, Download, FileText } from "lucide-react";
import { GoogleDriveBrandIcon } from "@/components/shared/GoogleDriveBrandIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { PPC_CAMPAIGN_ROW_FIELD_CELL } from "@/components/ppc/google/google-ads-row-constants";
import { PPC_DETAIL_INPUT_CLASS } from "@/components/ppc/google/google-ads-row-details-styles";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { cn } from "@/lib/utils";

/** Fixed height from first paint; long titles truncate inside the field. */
const ROW_GRID = cn(
  "grid h-8 w-full min-w-0 max-h-8 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-x-1.5 sm:h-9 sm:max-h-9 sm:gap-x-2",
);

const ROW_FIELD_CLASS = cn(
  PPC_DETAIL_INPUT_CLASS,
  "h-7 w-full min-w-0 truncate text-base text-zinc-100 sm:h-8",
);

const ROW_ACTIONS = "flex h-7 shrink-0 flex-nowrap items-center justify-end gap-0.5 sm:h-8 sm:gap-1";

const ROW_ACTION_BTN = cn(BULK_HEADER_TOOL_BTN, "h-7 w-7 shrink-0 p-0 sm:h-8 sm:w-8");

const ROW_ACTION_ICON = "h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4";

export type GscReportingReportRowProps = {
  stripeIndex?: number;
  /** Shown in Both mode (SEO / PPC). */
  laneLabel?: string;
  title: string;
  busy: boolean;
  hasReport: boolean;
  onCopyMarkdown: () => void;
  onDownloadMarkdown: () => void;
  onExportKb: () => void;
  onOpenGoogleDrive: () => void;
};

export function GscReportingReportRow({
  stripeIndex = 0,
  laneLabel,
  title,
  busy,
  hasReport,
  onCopyMarkdown,
  onDownloadMarkdown,
  onExportKb,
  onOpenGoogleDrive,
}: GscReportingReportRowProps) {
  const exportsEnabled = hasReport && !busy;
  const driveEnabled = hasReport && !busy;
  const periodLabel = title.trim() ? title : laneLabel ? `${laneLabel} report` : "Report";
  const displayValue = hasReport ? title : "";
  const placeholder = laneLabel ? `${laneLabel} report` : "Report";

  return (
    <div className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
      <div className={contentOptimizerRowStripeClass(stripeIndex)}>
        <div className={ROW_GRID}>
          <div className={cn(PPC_CAMPAIGN_ROW_FIELD_CELL, "pl-[5px]")}>
            <Input
              type="text"
              readOnly
              value={displayValue}
              placeholder={placeholder}
              aria-label={periodLabel}
              className={cn(ROW_FIELD_CLASS, "placeholder:text-muted-foreground")}
            />
          </div>
          <div className={ROW_ACTIONS}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={ROW_ACTION_BTN}
              disabled={!exportsEnabled}
              aria-label="Copy"
              onClick={onCopyMarkdown}
            >
              <Copy className={ROW_ACTION_ICON} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={ROW_ACTION_BTN}
              disabled={!exportsEnabled}
              aria-label="Download"
              onClick={onDownloadMarkdown}
            >
              <Download className={ROW_ACTION_ICON} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={ROW_ACTION_BTN}
              disabled={!exportsEnabled}
              aria-label="Knowledge base"
              onClick={onExportKb}
            >
              <FileText className={ROW_ACTION_ICON} aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={ROW_ACTION_BTN}
              disabled={!driveEnabled}
              aria-label="Google Drive"
              onClick={(e) => {
                e.stopPropagation();
                onOpenGoogleDrive();
              }}
            >
              <GoogleDriveBrandIcon className={ROW_ACTION_ICON} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
