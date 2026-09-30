# AISEO handoff module map (Google-Ads-main)

Handoff paths map 1:1 to this repo (Pulse-derived codebase).

| Task | Handoff module | Actual path |
|------|----------------|-------------|
| TASK-01 | json-repair-utility.ts | `src/lib/json-repair-utility.ts` |
| TASK-01 | use-bulk-auto-generate.ts | `src/hooks/use-bulk-auto-generate.ts` |
| TASK-02 | WordPress publishing | `src/lib/content-generation/wordpress-uploader.ts`, `src/hooks/overview/use-overview-upload.ts`, `src/hooks/content-optimization/bulk-optimization-post-loop.ts` |
| TASK-03 | Footer navigation | `src/components/manager/ManagerAppFooter.tsx` |
| TASK-04 | Entity generation | `src/components/integrations/EntityGenerationFeature.tsx`, `src/components/integrations/entity-generation/` |
| TASK-05 | Dashboard metrics | `src/hooks/use-quarter-editorial-counts.ts`, `src/lib/quarter-bounds.ts`, `src/components/integrations/wordpress/WordPressSiteList.tsx` |
| TASK-06 | Sitemap configuration | `src/components/keyword-research/bulk/BulkGeneratorSitemapMenu.tsx`, `src/lib/bulk/bulk-sitemap-mode.ts` |

Dev: `npm run dev` / `npm test`.
