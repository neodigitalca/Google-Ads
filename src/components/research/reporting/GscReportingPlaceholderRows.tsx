import { BlogIdeaRowCompact } from "@/components/keyword-research/bulk/BlogIdeaRowCompact";
import { CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";

export function GscReportingPlaceholderRows({
  startStripeIndex,
  count,
}: {
  startStripeIndex: number;
  count: number;
}) {
  if (count <= 0) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const stripeIndex = startStripeIndex + i;
        return (
          <div key={stripeIndex} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
            <BlogIdeaRowCompact
              row={{}}
              index={stripeIndex}
              stripeIndex={stripeIndex}
              isSelected={false}
              isExpanded={false}
              isProcessing={false}
              placeholder
              showSelect={false}
              onToggleSelect={() => {}}
              onToggleExpand={() => {}}
              onRowChange={() => {}}
            />
          </div>
        );
      })}
    </>
  );
}
