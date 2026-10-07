import { cn } from "@/lib/utils";

/** Modal-only surface: black canvas, 1rem Lato (via font-sans + text-base). */
export const PROPERTY_PROFILE_DIALOG_SURFACE = cn(
  "bg-black font-sans text-base text-white",
);

export const PROPERTY_PROFILE_HEADER_ROW = cn(
  "flex min-h-12 shrink-0 items-center gap-3",
);

/** Five icon-only settings pills (8×32 + gaps). Reserved so Settings does not shift layout. */
export const PROPERTY_PROFILE_HEADER_SETTINGS_SLOT = cn(
  "flex min-h-8 min-w-[11.5rem] shrink-0 items-center justify-end gap-1",
);

export const PROPERTY_PROFILE_PILL_ACTIVE =
  "bg-zinc-700 text-white shadow-none hover:bg-zinc-700 hover:text-white";

export const PROPERTY_PROFILE_PILL_INACTIVE =
  "bg-black text-zinc-400 hover:bg-zinc-900 hover:text-white";

export const PROPERTY_PROFILE_NAV_ACTIVE =
  "bg-zinc-800 text-white shadow-none hover:bg-zinc-800 hover:text-white";

export const PROPERTY_PROFILE_NAV_INACTIVE =
  "bg-transparent text-white hover:bg-zinc-900 hover:text-white";

export const PROPERTY_PROFILE_SCROLL_CLASS = "property-profile-scroll";
