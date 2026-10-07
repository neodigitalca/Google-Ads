/** Row labels for period A/B compare tables (dates live in footnote, not row headers). */
export const GSC_TABLE_SIDE_CURRENT = "Current";
export const GSC_TABLE_SIDE_PRIOR = "Prior";
export const GSC_TABLE_SIDE_DELTA = "Δ%";

export function splitGscCompareLabel(compareLabel: string): { primary: string; compare: string } {
  const parts = compareLabel.split(/\s+vs\s+/i).map((p) => p.trim());
  return {
    primary: parts[0] ?? "",
    compare: parts[1] ?? "",
  };
}

export function gscCompareTablePeriodFootnote(compareLabel: string): string {
  const { primary, compare } = splitGscCompareLabel(compareLabel);
  if (!primary && !compare) return "";
  if (primary && compare) {
    return `_Current: ${primary}. Prior: ${compare}._`;
  }
  return primary ? `_Current: ${primary}._` : `_Prior: ${compare}._`;
}
