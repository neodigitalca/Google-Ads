/**
 * Prompt-level rules for window blind / shade featured and blog images (non-gating).
 * Injected when title or body signals blinds, shades, or window treatments.
 */

export const WINDOW_TREATMENT_IMAGE_PROMPT_RULES = [
  "WINDOW TREATMENT IMAGE RULES (when depicting blinds, shades, or parts diagrams):",
  "CANADA / CORD SAFETY: Do not show exposed lift strings, cords, or dangling control strings running through shade fabric (including cellular/honeycomb). Use cordless, motorised, wand, or fully concealed/internal lift looks appropriate for the Canadian market unless the article explicitly targets a corded US-only product.",
  "PARTS / FLAT-LAY / EXPLODED DIAGRAMS: Show mechanical parts only (headrail, fabric stack, bottom rail, brackets, end caps, mounting hardware). Do not include batteries, battery packs, solar chargers, remotes, or generic power accessories unless the copy explicitly names Hunter Douglas and the image must show that exact Hunter Douglas accessory (e.g. PowerView). When in doubt, omit electronics and keep the parts layout clean.",
  "INSTALL + PARTS COMPOSITES: In-window scenes must use a real window frame and glazing; parts panels stay hardware-only without remotes or batteries unless Hunter Douglas exact match is required by the article.",
].join(" ");

const WINDOW_TREATMENT_TOPIC_RE =
  /\b(blinds?|shades?|shutters?|cellular|honeycomb|roller\s+shade|zebra\s+blind|window\s+treatment|hunter\s+douglas|parts\s+of\s+a\s+blind|blind\s+components?|top[- ]down|bottom[- ]up)\b/i;

export function isWindowTreatmentImageContext(
  ...parts: (string | undefined | null)[]
): boolean {
  const blob = parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (!blob) return false;
  return WINDOW_TREATMENT_TOPIC_RE.test(blob);
}

/** Empty string when topic does not apply; otherwise full rules block for prompts. */
export function windowTreatmentImagePromptSuffix(
  ...parts: (string | undefined | null)[]
): string {
  if (!isWindowTreatmentImageContext(...parts)) return "";
  return ` ${WINDOW_TREATMENT_IMAGE_PROMPT_RULES}`;
}
