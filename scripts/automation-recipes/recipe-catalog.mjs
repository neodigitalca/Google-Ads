/**
 * Automation recipe catalog definitions (data).
 */
import {
  trigger,
  action,
  calendarAction,
  POLL,
  COOLDOWN,
  SIG_IMPR_UP_CTR_DOWN,
  SIG_CLICKS,
  SIG_CTR,
  SIG_POSITION,
  SIG_QUICK_WIN,
  PAGES_META_ACTION,
  ENTITY_PAGE_CREATOR_PAYLOAD,
  ENTITY_GENERATOR_PAYLOAD,
  SAP_GENERATOR_PAYLOAD,
} from "./recipe-build-helpers.mjs";
import { recipesPartA } from "./recipe-catalog-a.mjs";
import { recipesPartB } from "./recipe-catalog-b.mjs";

export const recipes = [...recipesPartA, ...recipesPartB];
