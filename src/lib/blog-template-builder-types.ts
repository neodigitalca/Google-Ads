import type { KeywordData } from "./keyword-types";

export interface BlogTemplateContext {
  flowTitle?: string;
  flowPurpose?: string;
  keywordData?: KeywordData;
  userPrompt?: string;
  prefilledRowContract?: string;
}

export type ChecklistFromSelectionsResult = {
  items: string[];
  h2Outline?: string[];
};
