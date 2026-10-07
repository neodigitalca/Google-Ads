/** ACF Origin is for entity/SAP service-area pages only, not standard blog posts. */
export function acfOriginAppliesForSitemapType(sitemapType: string | undefined): boolean {
  return sitemapType === "entity";
}
