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
import { recipesPartB1 } from "./recipe-catalog-b1.mjs";
import { recipesPartB2 } from "./recipe-catalog-b2.mjs";

export const recipesPartB = [...recipesPartB1, ...recipesPartB2];
