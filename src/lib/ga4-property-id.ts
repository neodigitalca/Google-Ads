/**
 * GA4 Data API property id: numeric only (Admin → Property settings).
 * Not the Measurement ID (G-…).
 */
export function normalizeGa4PropertyIdForApi(raw: string | undefined | null): string {
  let id = (raw ?? "").trim();
  if (!id) return "";
  id = id.replace(/^properties\/?/i, "").trim();
  if (/^G-/i.test(id)) {
    throw new Error(
      "Use the numeric GA4 Property ID from Admin → Property settings, not the Measurement ID (G-…).",
    );
  }
  if (!/^\d+$/.test(id)) {
    throw new Error("GA4 Property ID must be numeric digits only.");
  }
  return id;
}

export {
  resolveGa4PropertyIdForReporting,
  resolveGa4PropertyIdForReportingAsync,
} from "@/lib/ga4-reporting-property";
