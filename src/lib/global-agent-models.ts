import { DEFAULT_SETTINGS } from "@/components/integrations/wordpress/OptimizationSettingsPanel";
import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_PRESETS } from "@/lib/image-model-defaults";

/** Must match {@link NEO_PULSE_LLM_MODEL_KEY} in manager-cloud-settings-snapshot (legacy blog default). */
const LEGACY_LLM_MODEL_KEY = "neo-pulse-llm-selected-model";

/** Global Research agent (checklist, blueprint, image planning). */
export const NEO_PULSE_AGENT_RESEARCH_MODEL_KEY = "neo-pulse-agent-research-model";
/** Global Blog agent (harness, title, meta). */
export const NEO_PULSE_AGENT_BLOG_MODEL_KEY = "neo-pulse-agent-blog-model";
/** Global Image agent (image generation). */
export const NEO_PULSE_AGENT_IMAGE_MODEL_KEY = "neo-pulse-agent-image-model";

const GLOBAL_RESEARCH_MODEL_KEY = "global_research_model";

export const TEXT_AGENT_MODEL_PRESETS: { value: string; label: string }[] = [
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "openai/gpt-5", label: "GPT-5" },
];

export { IMAGE_MODEL_PRESETS };

function readStorageKey(key: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const t = localStorage.getItem(key)?.trim();
    return t || undefined;
  } catch {
    return undefined;
  }
}

export function readGlobalResearchAgentModel(): string {
  return (
    readStorageKey(NEO_PULSE_AGENT_RESEARCH_MODEL_KEY)
    ?? readStorageKey(GLOBAL_RESEARCH_MODEL_KEY)
    ?? DEFAULT_SETTINGS.researchModel
  );
}

export function readGlobalBlogAgentModel(): string {
  return (
    readStorageKey(NEO_PULSE_AGENT_BLOG_MODEL_KEY)
    ?? readStorageKey(LEGACY_LLM_MODEL_KEY)
    ?? DEFAULT_SETTINGS.model
  );
}

export function readGlobalImageAgentModel(): string {
  return readStorageKey(NEO_PULSE_AGENT_IMAGE_MODEL_KEY) ?? DEFAULT_IMAGE_MODEL;
}

export function writeGlobalResearchAgentModel(model: string): void {
  if (typeof window === "undefined") return;
  const id = model.trim();
  if (!id) return;
  try {
    localStorage.setItem(NEO_PULSE_AGENT_RESEARCH_MODEL_KEY, id);
    localStorage.setItem(GLOBAL_RESEARCH_MODEL_KEY, id);
  } catch {
    /* ignore */
  }
}

export function writeGlobalBlogAgentModel(model: string): void {
  if (typeof window === "undefined") return;
  const id = model.trim();
  if (!id) return;
  try {
    localStorage.setItem(NEO_PULSE_AGENT_BLOG_MODEL_KEY, id);
    localStorage.setItem(LEGACY_LLM_MODEL_KEY, id);
  } catch {
    /* ignore */
  }
}

export function writeGlobalImageAgentModel(model: string): void {
  if (typeof window === "undefined") return;
  const id = model.trim();
  if (!id) return;
  try {
    localStorage.setItem(NEO_PULSE_AGENT_IMAGE_MODEL_KEY, id);
  } catch {
    /* ignore */
  }
}
