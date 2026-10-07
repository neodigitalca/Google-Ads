import { LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPropertyListRowBlackIconButtonClass,
  getPropertyListRowIconButtonHoverGlowClass,
} from "./cyberpunk-theme";
import type { WordPressPropertyRowDisplay } from "@/lib/wordpress-properties-row-display";
import { propertyShowsReportingShortcut } from "@/lib/wordpress-property-profile-tags";
import type { WordPressSite } from "../types";

/** Fixed slot immediately left of month picker (icon-only). */
export const PROPERTY_REPORTING_SHORTCUT_SLOT_CLASS =
  "flex h-full shrink-0 items-center justify-center";

type PropertyReportingShortcutPillProps = {
  site: WordPressSite;
  rowDisplay?: WordPressPropertyRowDisplay;
  onOpenReporting: (site: WordPressSite) => void;
};

export function PropertyReportingShortcutPill({
  site,
  rowDisplay = "compact",
  onOpenReporting,
}: PropertyReportingShortcutPillProps) {
  const compact = rowDisplay === "compact";
  const show = propertyShowsReportingShortcut(site);
  const iconClass = cn("shrink-0 text-green-400", compact ? "h-4 w-4" : "h-5 w-5");

  return (
    <div
      className={cn(
        PROPERTY_REPORTING_SHORTCUT_SLOT_CLASS,
        compact ? "min-h-8 w-8 sm:min-h-9 sm:w-9" : "min-h-9 w-9",
      )}
      aria-hidden={!show}
    >
      {show ? (
        <button
          type="button"
          className={cn(
            getPropertyListRowBlackIconButtonClass(compact),
            getPropertyListRowIconButtonHoverGlowClass("powerOn"),
            "[&_svg]:!text-green-400",
          )}
          title="Connect property and open GSC Reporting"
          aria-label={`Connect ${site.name} and open GSC Reporting`}
          onClick={(e) => {
            e.stopPropagation();
            onOpenReporting(site);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <LineChart className={iconClass} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
