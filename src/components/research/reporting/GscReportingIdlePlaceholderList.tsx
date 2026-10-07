import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import { GscReportingPlaceholderRows } from "@/components/research/reporting/GscReportingPlaceholderRows";
import { CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";
import { cn } from "@/lib/utils";

/** Full placeholder grid (no report row yet). */
export function GscReportingIdlePlaceholderList({
  count = BULK_GENERATOR_EMPTY_ROW_COUNT,
}: {
  count?: number;
}) {
  return (
    <div
      className={cn(
        CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
      aria-label="Report rows"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <GscReportingPlaceholderRows startStripeIndex={0} count={count} />
      </div>
    </div>
  );
}
