# Monolith audit notes (desktop app)

Senior agentic review inventory for refactor planning. Regenerate line counts with:

```bash
node scripts/generate-monolith-inventory.mjs
```

Machine-readable list: [`monolith-inventory.json`](./monolith-inventory.json).

## Scope

| In scope | Out of scope |
|----------|----------------|
| `scripts/` | `wordpress-plugins/` |
| `src/lib/` | |
| `src/components/` | |

**Summary (2026-10-07 scan):** 146 monoliths (≥500 lines), 243 watch (300–499), 389 files total at ≥300 lines. By area: scripts 6+15, `src/lib` 89+170, `src/components` 51+58.

---

## Phase 1 — Scripts

### Shared extraction (do before splitting consumers)

**Target:** `scripts/research/_shared/`

| Module | From | Contents |
|--------|------|----------|
| `env.mjs` | `chatgpt-audit/lib.mjs`, `local-dominator/lib.mjs` | `loadEnv`, `resolveEnv`, `requireEnv`, repo paths |
| `playwright-session.mjs` | both libs | cookie read/write, stale checks, session JSON paths |
| `progress-screenshots.mjs` | chatgpt lib | `createProgressWriter`, wait + screenshot helpers |

**Refactor order:** shared env/session first, then split each product lib (chatgpt vs local dominator).

---

### Monoliths (≥500 lines)

#### `scripts/research/chatgpt-audit/lib.mjs` (~1664)

**Responsibilities**

- Dotenv and OpenRouter key resolution (including PHP secrets file read)
- Playwright: navigate ChatGPT, composer read/submit, assistant wait
- AgentMail OTP polling and login flow
- OpenRouter: onboarding profile, audit prompt composition
- Lean browsing proxy hooks (re-export)
- Control/query file I/O for batch jobs

**Dependencies:** Playwright page, `.env.chatgpt-audit`, optional `neo-pulse-app-secrets.php`, AgentMail API, OpenRouter.

**Proposed modules:** `env.mjs`, `session.mjs`, `agentmail-otp.mjs`, `chatgpt-ui.mjs`, `openrouter-audit-prompt.mjs`, `batch-io.mjs` (thin barrel `index.mjs`).

**Risk:** `chatgpt-audit-jobs.mjs` and `run-chatgpt-audit-client-harness.ts` import this lib; job CLI must stay stable.

**Tests:** none dedicated; verify via research job smoke.

---

#### `scripts/build-automation-recipes.mjs` (~1151)

**Responsibilities**

- Inline GSC trigger/action recipe definitions (data-as-code)
- Writes `wordpress-plugins/neo-pulse-app/recipes/*.json` (path is outside desktop scope but script lives in repo)

**Proposed modules:** `recipes/catalog/*.ts` or JSON data + `build-automation-recipes.mjs` (<100 lines codegen only).

**Risk:** Recipe JSON drift if catalog split wrong; diff generated JSON before/after.

**Refactor order:** extract catalog data first, keep builder API identical.

---

#### `scripts/pulse-assist-feature-playbooks.cjs` (~796)

**Responsibilities**

- Large `FEATURE_PLAYBOOKS` array (UI steps per Pulse Assist feature)
- Consumed by Pulse Assist catalog build

**Proposed modules:** `src/lib/pulse-assist/feature-playbooks.data.json` + thin `feature-playbooks.cjs` loader, or split by `moduleId` files.

**Risk:** Assist search quality if playbook IDs or aliases change.

---

#### `scripts/generate-api-docs.mjs` (~699)

**Responsibilities**

- Scan PHP route handler files under `neo-pulse-app/includes`
- Map handler files to URL prefixes, emit `docs/api` markdown + manifest
- Override merge from `docs/api/_overrides`

**Proposed modules:** `parse-php-handlers.mjs`, `render-api-markdown.mjs`, `manifest.mjs`.

**Risk:** Doc drift vs live routes; run script and diff `docs/api` after split.

---

#### `scripts/research/browser-automation/agent-loop.mjs` (~623)

**Responsibilities**

- Multi-round vision agent loop (OpenRouter + screenshots)
- Tool dispatch via `./tools.mjs`, block detection, execution mode, SERP fallback

**Dependencies:** Already partially split into `tools/`, `block-detect.mjs`, `execution-mode.mjs`, `serp-dfs.mjs`.

**Proposed modules:** `agent-round.mjs` (one iteration), `agent-loop.mjs` (orchestration only), keep tools package as-is.

**Prompt-level:** Vision stuck detection and tool choice belong in prompt/schema contract; code validates rounds and stop conditions only.

**Risk:** `browser-automation-jobs.mjs` worker entry.

---

#### `scripts/research/local-dominator/lib.mjs` (~507)

**Responsibilities**

- Env/session (duplicate of chatgpt patterns)
- Local Dominator login and export automation

**Proposed modules:** use `_shared/env.mjs` + `_shared/playwright-session.mjs`, then `local-dominator/auth.mjs`, `local-dominator/export.mjs`.

**Risk:** `local-dominator-export-jobs.mjs`.

---

### Watch list (300–499 lines)

| Lines | File | Notes |
|------:|------|-------|
| ~426 | `scripts/build-pulse-assist-catalog.cjs` | Catalog codegen; pair with playbooks split |
| ~415 | `scripts/research/browser-automation/tools/definitions.mjs` | Tool schemas; keep with tools package |
| ~391 | `scripts/gsc-dev-fetch-queries.mjs` | Dev GSC helper; Vite plugin coupling |
| ~383 | `scripts/chatgpt-audit-jobs.mjs` | Job orchestration; thin after lib split |
| ~368 | `scripts/research/browser-automation/site-health-audit.mjs` | One-off audit runner |
| ~358 | `scripts/edmonton-internal-links/apply-map.mjs` | Client-specific link map |
| ~348 | `scripts/audit-chrome-console.mjs` | Chrome console audit |
| ~341 | `scripts/edmonton-internal-links/link-map-rules.mjs` | Rules data + logic |
| ~316 | `scripts/local-dominator-export-jobs.mjs` | Job wrapper |
| ~316 | `scripts/research/browser-automation/tools/executor.mjs` | Tool execution |
| ~309 | `scripts/research/browser-automation/tools/interaction.mjs` | DOM interaction |
| ~302 | `scripts/setup-agentmail.mjs` | Setup script |
| ~300 | `scripts/render-provision.mjs` | Render provisioning |

---

## Phase 2 — `src/lib`

### Top orchestrators (split first)

#### `src/lib/bulk-auto-generate.ts` (~3154)

**Responsibilities**

- End-to-end bulk row pipeline: CSV/checklist/blueprint, keyword research prefetch, content generation hooks
- WordPress create/update, media, ACF, FAQ, SEO JSON bundles, harness payloads for overview optimize/upload
- Re-exports CSV parser and entity helpers

**Dependencies:** ~90 import lines across `bulk/*`, `content-generation/*`, `overview/*`, `wordpress-api`, keyword types.

**Proposed modules**

| Module | Extract |
|--------|---------|
| `bulk-auto-generate-types.ts` | Options, result, harness payload types |
| `bulk-wordpress-posting.ts` | Post create/update, scheduling, destinations |
| `bulk-row-pipeline.ts` | `generateRowOutputs`, `generateBlueprintAndContent` |
| `bulk-keyword-prefetch.ts` | Prefetch/cache validation |
| `bulk-auto-generate.ts` | Thin facade re-exporting public API |

**Refactor order:** types → posting → row pipeline → shrink facade. Do not split until `bulk-content-generator.ts` boundaries are clear.

**Risk:** `use-bulk-auto-generate.ts`, `BulkAutoGeneratePanel.tsx`, harness tests (`bulk-harness.test.ts`).

---

#### `src/lib/workflow/workflow-runner.ts` (~1750)

**Responsibilities**

- Walk workflow graph: agent runs, CSV rows, then-steps, RAG archive, client scope
- Integrates task execution, browser automation flags, ChatGPT audit payload, content gap counts

**Dependencies:** Large set of `workflow-*` siblings already exist; runner still aggregates too much.

**Proposed modules:** `workflow-walk-state.ts`, `workflow-step-dispatch.ts` (per node kind), keep `workflow-runner.ts` as entry.

**Refactor order:** extract dispatch table by node type before moving RAG/archive helpers.

**Risk:** `workflow-then-runner.test.ts`, live workflow runs in Manager.

---

#### `src/lib/content-generation/content-sanitizer.ts` (~1768)

**Responsibilities**

- Many single-purpose HTML/Markdown transforms (links, tables, lists, forbidden sections, em dash removal)
- Composed `sanitizeContentForUpload` (and related) pipeline

**Proposed modules:** `sanitizer/link-rules.ts`, `sanitizer/table-rules.ts`, `sanitizer/markdown-rules.ts`, `sanitizer/pipeline.ts`.

**Prompt-level:** Forbidden wording and section policy should stay aligned with prompt builders (`content-word-blocklist.ts`); sanitizer enforces shape, not semantic rewrite.

**Risk:** Broad test surface; any upload path using `sanitizeContentForUpload`.

---

### Overview harness cluster (≥500 lines)

Shared pattern: overview bulk action → OpenRouter/harness steps → file artifacts → WP upload bindings.

| Lines | File |
|------:|------|
| 927 | `overview-blog-in-content-image-harness-run.ts` |
| 782 | `overview-blog-links-harness-run.ts` |
| 572 | `overview-research-harness-run.ts` |
| 572 | `overview-blog-wikipedia-link-harness-run.ts` |
| 523 | `overview-wp-upload-harness-run.ts` |

**Audit outcome:** Define `overview-harness-contract.ts` (inputs, progress events, artifact names). Each harness implements contract; shared progress + error shaping in one module.

**Refactor order:** contract + one pilot harness (e.g. wp-upload) before touching image/links harnesses.

---

### Other top lib monoliths (from inventory)

| Lines | File | Cluster note |
|------:|------|----------------|
| 1812 | `blog-template-builder.ts` | Template/checklist generation |
| 1555 | `content-optimization/topic-research-fanout.ts` | Fan-out research orchestration |
| 1496 | `image-reference-research.ts` | Image ref + OpenRouter |
| 1449 | `content-generation/wordpress-uploader.ts` | Upload pipeline (pair with sanitizer) |
| 1230 | `local-seo-strategy-from-grid.ts` | Local strategy from grid data |
| 1117 | `gsc-reporting/gsc-reporting-fetch.ts` | GSC fetch aggregation |
| 1105 | `vertical-benchmark/vertical-benchmark-bulk-template.ts` | Benchmark templates |
| 1101 | `bulk/bulk-content-generator.ts` | Core generator (split before bulk-auto-generate) |

---

## Phase 3 — `src/components`

### Top UI monoliths

#### `integrations/EntityGenerationFeature.tsx` (~2701)

**Responsibilities**

- Dialog UX for entity generation count/modifiers
- Wikipedia/DataForSEO search, criteria validation, conflict checks vs sitemap
- CSV template generation, clipboard/download, title AI suggestion
- Heavy `notify` and `streamChatCompletion` usage

**Proposed split**

| Piece | Module |
|-------|--------|
| State + orchestration | `useEntityGeneration.ts` hook |
| Wikipedia/validation | `entity-generation/runEntityPipeline.ts` (lib, server-safe fetch via existing APIs) |
| Dialogs | `EntityGenerationDialog.tsx`, `EntityCsvTemplateDialog.tsx` |
| Shell | `EntityGenerationFeature.tsx` (imperative ref + composition only) |

**Refactor order:** move pipeline to `src/lib` first (testable), then thin UI.

**Risk:** `WordPressFeature.tsx` ref API; stacked labels in dialogs (migrate to flat inline forms when touched).

---

#### `keyword-research/BulkAutoGeneratePanel.tsx` (~1191)

**Pair with:** `bulk-auto-generate.ts`, `use-bulk-auto-generate.ts`.

**Split:** workspace header (existing bulk header components), details drawer body, hook for run state.

---

#### Research tabs (~1800+ lines each)

| File | Split target |
|------|----------------|
| `CompetitorResearchTab.tsx` | Tab shell + `CompetitorSiteGrid` + report panel (grid already separate at ~539) |
| `ProposalResearchTab.tsx` | Form row vs results vs export |
| `LocalStrategyResearchTab.tsx` | Strategy form vs grid vs run actions |

**Chrome:** Each tab should use `UnifiedWorkspaceChrome` via existing `*WorkspaceHeader.tsx` patterns when refactored.

---

#### Other priority components

| Lines | File | Notes |
|------:|------|-------|
| 2340 | `overview/MetaOptimizerPageRowDetails.tsx` | Row detail tiles; pair with `bulk-details-tile-sections.tsx` |
| 2078 | `sap-generator/LocalAnalysisPanel.tsx` | SAP local analysis UI |
| 1807 | `integrations/wordpress/BulkOptimizationPanel.tsx` | Bulk optimize UI |
| 1241 | `integrations/wordpress/SitePropertyFormFields.tsx` | Large form; split by connection type |
| 1005 | `manager/pulse-forge/TaskBuilderView.tsx` | Forge task builder |

---

## Refactor priority (cross-phase)

1. `scripts/research/_shared` + split chatgpt/local dominator libs  
2. Script data monoliths (recipes, playbooks)  
3. `bulk/bulk-content-generator.ts` then `bulk-auto-generate.ts`  
4. `workflow-runner.ts` dispatch extraction  
5. Overview harness contract + one pilot harness  
6. `EntityGenerationFeature.tsx` pipeline to lib  
7. Research tabs and overview row details  

---

## Verification checklist

- [ ] `node scripts/generate-monolith-inventory.mjs` summary unchanged except intentional splits  
- [ ] Script splits: `node scripts/build-automation-recipes.mjs`, `node scripts/generate-api-docs.mjs`  
- [ ] Lib splits: `npm test -- workflow`, `npm test -- bulk-harness`, `npm test -- overview-bulk-details-bindings`  
- [ ] No new browser fetch to third parties in extracted lib code (`backendApiUrl` / `/api/*` only)

---

## Final review (2026-10-07)

- Scope confirmed: desktop paths only; WordPress plugin PHP not audited here.  
- Inventory matches scan: 6 script monoliths, 89 lib monoliths, 51 component monoliths (includes colocated tests ≥500 lines).  
- No duplicate refactor paths: shared research env/session dedupe scheduled before product libs.  
- Highest Murphy risk remains `bulk-auto-generate.ts` + `BulkAutoGeneratePanel.tsx` + `EntityGenerationFeature.tsx` during partial splits.
