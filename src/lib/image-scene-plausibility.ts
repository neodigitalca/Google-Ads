/** Required checklist item title (case-insensitive match in parseImageChecklist). */
export const IMAGE_SCENE_PLAUSIBILITY_CHECKLIST_TITLE = "Physical scene plausibility";

export const IMAGE_SCENE_PLAUSIBILITY_PROMPT = [
  "PHYSICAL SCENE PLAUSIBILITY (mandatory for photoreal featured images):",
  "Every object must appear in its real-world context. Do not depict catalog-style installs on blank walls.",
  "Window blinds, shutters, or curtains MUST show a window frame and glazing; light through slats or exterior beyond glass. Never window treatments mounted on solid drywall with no opening.",
  "Doors, garage doors, and gates MUST include frame, jamb, and surrounding structure.",
  "Built-in fixtures (HVAC, sinks, appliances, outlets) MUST sit on the correct surfaces (counter, ceiling, cabinet), not floating on flat wall alone unless the article explicitly requests an isolated studio product shot.",
  "Prefer in-context residential or commercial interior/exterior for service and blog featured images over sterile product-on-wall shots.",
  "When reference photos are attached, match their install context and setting; do not strip the subject onto an empty wall.",
].join(" ");

export class ImageChecklistParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageChecklistParseError";
  }
}

export function hasPhysicalScenePlausibilityItem(items: { title: string }[]): boolean {
  const needle = IMAGE_SCENE_PLAUSIBILITY_CHECKLIST_TITLE.toLowerCase();
  return items.some((item) => item.title.trim().toLowerCase().includes(needle));
}
