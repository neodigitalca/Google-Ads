import type { GscReportingOutlineResult, GscReportingSectionPlan } from "@/lib/gsc-reporting/gsc-reporting-types";
import {
  applyReportPeriodToClientSeason,
  emptyGscClientSeasonContext,
  formatGscClientSeasonPromptBlock,
  GSC_NO_SEASON_REPEAT_RULE,
  GSC_SEASONAL_CONTEXT_RULE,
  type GscClientSeasonContext,
} from "@/lib/gsc-reporting/gsc-reporting-client-season";
import { formatGscReportTitlePeriod } from "@/lib/gsc-reporting/gsc-reporting-document-title";
import {
  COMPARE_SIGNALS_LEXICON,
  searchPerformanceH2ForCompareKind,
  type GscCompareKind,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { QUERY_SPOTLIGHT_LEXICON } from "@/lib/gsc-reporting/gsc-query-spotlight";
import { REPORTING_ENGLISH_PROSE_RULES } from "@/lib/reporting/reporting-english-prose";

/** All GFM pipe tables: short metric headers so columns stay scannable (charts + tables). */
const TABLE_HEADER_ABBREV =
  "**Column headers (mandatory):** Abbreviate **every metric** column - **Clk**, **Imp**, **Pos**, **CTR**, **Queries**, **Sess**, **Eng sess**, **Eng rate**, **Ev/sess**, **Key ev**; for change use **Δ%** (**Clk Δ%**, **Imp Δ%**, **Pos Δ%**). **Compare tables:** first column row labels **Current**, **Prior**, **Δ%** only (full date ranges belong in prose or footnotes, **not** in table row headers). **Forbidden** in header row: long month/date column titles (**Clicks (Mar 20xx)**, **July 1, 2026 to…**). Dimension columns: **Theme**, **Segment**, **Query**, **Page**, **Kw**, **Example**. **Forbidden** columns: **Inc**, **Includes**.";

/** Shared rules for non-technical executives: tables-first for stats, compact prose, readable links. */
const EXEC_RULES =
  "AUDIENCE: **Senior executives** - they must grasp the section in **under ~90 seconds**. **Overwhelm = failure:** **no** dense grids, **no** multiple similar tables in one section, **no** repeating the same story (site totals vs pages vs queries) with duplicate column layouts. **TONE:** Confident and **constructive** - lead with **wins and momentum**; frame gaps as **opportunities** or **observations**, not a bleak audit. **FORBIDDEN (report output):** Do **not** use headings or labels such as **Priority Next Steps**, **Next steps**, **Recommended actions**, **Keyword strategy** (as a standalone tactic section), or numbered tactical checklists tied to specific query strings. Write **analysis and interpretation** (what changed, what the data shows), not a marketing task list with named campaigns. **No** extra `###` / `####` subheadings under the section **except** `### Key Insights` inside **Executive Summary** only - **no** titles like **Top Performing Query Categories** or **(Month-over-Month)** above tables; **one** `##` section heading, then prose and **at most one** table. **FORMATTING:** Plain **GitHub-Flavored Markdown only** - **no** HTML (`<span>`, `<font>`, `<a>`, `<div>`), **no** inline CSS/color (no green or other colored accents), **no** emoji as decoration. **Section H2 (first line):** Output **exactly** the **Target H2** from the user message - blog-style **Title Case** (major words capitalized); **never** sentence-case the H2; **never** add month names, years, or date spans to the H2 (period labels belong in tables only). **Links:** only `[label](https://...)` - **do not** wrap the whole link in `**bold**` (no `**[label](url)**`); **do not** wrap links in backticks in table cells (write `[label](url)` directly, not `` `[label](url)` ``); use a normal markdown link. **CMS duplicate URLs (critical):** **Never** cite, quote, paste, or link URLs whose **path ends with `-2` through `-30`** (copy slugs like `…-ontario-2`, `…-united-states-2`). Those rows are **ignored** in RETRIEVED DATA for reporting: **do not** name them in prose, **do not** put them in tables, **do not** use them as examples. Summarize **only** the canonical topic or segment (same slug **without** the `-N` suffix) or use theme labels (e.g. “Austin service area”) with **no** duplicate path strings. **Near-duplicate pages:** Do **not** surface separate rows or long titles for CMS copy slugs (`…-2`, `…-3` in the URL) or titles ending in ` 2`, ` 3`, `-2`, `(2)` - **omit** the duplicate line or merge into the canonical topic; **link labels** must not read like “… Ontario 2”. **NO REDUNDANCY:** **Search Performance Compared Month Over Month** is the **only** place for the **site-wide** KPI table (total clicks, impressions, search queries, CTR, average position and their MoM **%**). **Executive Summary** may mention the story **without** that table. **Do not** repeat that KPI table or re-list those **same** site-wide KPI totals with MoM % in **Key Performance Insights**, **SAP & Local SEO**, or **Content Performance**. **Do not** paste two query/theme MoM grids that show the **same** rows and **same** numbers as if they were new. **Do not** paste another **full** Mar-vs-Feb (or period A vs B) **per-page** spreadsheet in multiple sections - executives should **not** see duplicate Δ% column layouts for the same URLs or queries. **DATA PRESENTATION:** Default to **brief prose + at most ONE GFM pipe table per section**; **max 6 data rows** per table; **≤7 columns** for theme tables (**Theme | Clk | Clk Δ% | Imp | Imp Δ%** ± optional **Pos | Pos Δ%**); **abbreviated metric headers** always (**Clk**, **Imp**, **Pos**, not long words). Prefer **theme / insight rows** over raw URL lists. **Short bullets** for non-tabular callouts (**cap 3–5**). **AGGREGATION:** Theme labels are fine, but **each table row with metrics** must map to **one** CSV row (no blending figures across rows). LISTS: **bold labels**. **KEYWORDS AND TITLES:** Do **not** wrap search queries, keywords, page titles, post slugs, or brand names in ASCII or curly quotation marks. Present them in **plain text** or use **Markdown bold** for scan emphasis (**only** where something should stand out). **Forbidden:** decorative quoting (e.g. wrong: \"term\" or 'term'); correct: **term** or plain term. Same rule inside table **Theme** / **Segment** / **Query** cells. LINKS: **`[Short human label](full URL)`** for pages - **never** paste naked `https://…` URLs in prose or tables; **never** wrap links or URLs in backticks. TABLES: **one** primary table per section unless explicitly multi-part; **never** stack two page-level performance tables back-to-back. **Theme / category / insight MoM (mandatory column order + abbrev headers):** **Theme | Clk | Clk Δ% | Imp | Imp Δ%** - **level then delta** for Clk, then **level then delta** for Imp (current-period counts + **% change vs prior** from RETRIEVED DATA). **Not** delta-only columns; **not** **Clicks (Mar)** + **Clicks (Feb)** + **Clicks Δ%** (too wide). Optional **Pos | Pos Δ%** as columns 6–7 only if needed; **≤7 columns**.";

/** Canonical site-wide MoM KPI table only (Search Performance section). */
const TABLE_RULE_SITE_MOM =
  "**Search Performance (this section only):** **Do not** output a pipe table in model text. The app injects a fixed **Site search totals (GSC)** table (**Clk**, **Imp**, **Queries**, **CTR**, **Pos** columns; **Current** / **Prior** / **Δ%** rows). Write **2–3 sentences** of interpretation after that table appears in the final document (lead with totals story, position gloss, **COMPARE_SIGNALS** when present).";

/** Theme/category/insight rows: Clicks + Δ, then Impressions + Δ (no raw 10-col MoM export). */
const TABLE_RULE_THEME_DELTA =
  "**Theme / category / insight tables (all sections except the canonical Search Performance MoM table):** **Mandatory column order:** **Theme | Clk | Clk Δ% | Imp | Imp Δ%** - current-period **Clk** total then **Clk Δ%**, then **Imp** total then **Imp Δ%**. Same **% change** formula as the CSV. Optional **Pos | Pos Δ%** as 6th–7th columns. **Headers must use** **Clk**, **Imp**, **Pos**, **Δ%** (abbreviated). **Forbidden:** **Clicks (Mar)** + **Clicks (Feb)** + **Clicks Δ%** triplets, **forbidden:** full per-query MoM paste, **forbidden:** reordering so deltas are not immediately after their level.";

/** Numeric grounding: RETRIEVED DATA always; OUTLINE_GROUNDING when present in user message. */
const GROUNDING_RULE_WITH_OUTLINE =
  "**NUMERIC GROUNDING:** Any **digit**, **%**, **CTR**, or **position** figure in prose or tables must match a value in **RETRIEVED DATA** or, when the user message includes **OUTLINE_GROUNDING**, in that block (same digits; **no** recomputed % or rounded substitutes). If **OUTLINE_GROUNDING** is absent, **RETRIEVED DATA** is the only numeric source. If you cannot support a claim, state it **without numbers** or **omit** it. **Do not** invent URL-, query-, or page-level stats.";

/** Client report copy must never echo harness / CSV / sitemap internals. */
const CLIENT_FACING_DATA_LANGUAGE =
  "**CLIENT-FACING LANGUAGE (mandatory in report output):** The reader is the client. In **prose, headings, bullets, table headers, and table cells**, **never** name internal data, files, or harness labels. **Forbidden in output:** `RETRIEVED DATA`, `OUTLINE_GROUNDING`, `COMPARE_SIGNALS`, `FILTERED_PAGES_FOR_SAP`, `ENTITY_SITEMAP_ALLOWLIST`, `RAW_DATA`, CSV filenames (`Pages-MoM.csv`, `Queries-MoM.csv`, `GSC-sitemaps.csv`, `Site-totals-MoM.csv`, GenerativeAI filenames, and similar), sitemap file stems (`post-sitemap`, `page-sitemap`, `service-area-sitemap`, `shop-by-room-sitemap`, `hunter-douglas-sitemap`, and similar), and ALL_CAPS / snake_case block names. Use those names **only** to find numbers. When you refer to the evidence, write **the site's data**, **this period's search data**, or **page performance**.";

const NUMBER_FORMAT_CA =
  "**NUMBER FORMAT (Canadian English):** In prose and tables write counts with thousands grouping: `253,441` not `253441` (comma thousands, period decimals). Copy the **same digits** as RETRIEVED DATA. Omit `.00` when the value is a whole number. When a fractional part is non-zero, keep **two** decimal places (`8.40`, `12.50%`). Thousands separators are **not** comma-joined metric bundles. **Exact values only:** **Forbidden** trailing **+**, **~**, **≈**, **about**, **approximately**, **over**, **more than**, or rounded shorthand (`6,000+`, `20.00+`) when RETRIEVED DATA has an exact figure. Write the full number (`6,124`, `20.47`).";

/** One theme row must not blend metrics from different CSV rows (fixes hallucinated aggregates). */
const THEME_ROW_INTEGRITY =
  "**THEME ROW INTEGRITY:** Each table row under **Theme** / **Segment** / **Query** with **Clk**, **Imp**, **Δ%** must match **exactly one** CSV row visible in **RETRIEVED DATA** for this section (same query string or same canonical page URL). **Forbidden:** merging clicks from one row with impressions from another; **forbidden:** synthetic buckets that do not map one-to-one unless prose is **qualitative only** (no shared numeric columns).";

/** Align marketing tone with signed deltas from the CSV. */
const DIRECTIONAL_LANGUAGE =
  "**DIRECTIONAL LANGUAGE:** Words like **growth**, **surge**, **strong gains**, **click growth** apply only when **Clk Δ%** or **Imp Δ%** on the cited row is **strictly positive**. At ~**0%** use **steady**, **flat**, or **unchanged**. When **Clk Δ%** or **Imp Δ%** is negative use **down**, **lower**, **pullback**, or **softened** (not growth). For **Pos Δ%** alone: **never** open with ranking loss when **Imp Δ%** on the same row is strongly positive or **QUERY_SPOTLIGHT_NARRATIVE** marks **impression_footprint_expansion**; explain **broader visibility / mix dilution** first, then average position.";

/** Period-progress reports: neutral monthly facts only (especially GA traffic). */
const PERIOD_PROGRESS_MATTER_OF_FACT =
  "**MATTER-OF-FACT MONTHLY DATA (period progress):** State each month as **standalone facts** (e.g. **July 2026** had **X** total users). **Forbidden in prose:** **increase**, **decrease**, **up**, **down**, **rose**, **fell**, **grew**, **declined**, **improved**, **worsened**, **trend**, **momentum**, **surge**, **pullback**, **stronger**, **weaker**, **compared to** the prior month, or any month-over-month direction story. **Do not** interpret injected table **Δ%** columns in words. **At most one short closing sentence** (optional, website traffic or executive summary only): as **more reporting periods** are collected, **historical period comparisons** will become available.";

/** Executive sections: full-sentence bullets with metrics (not telegraphic totals). */
const KEYWORD_BOLD_NOT_QUOTES =
  "**KEYWORDS / QUERIES (mandatory):** When you name a search query, keyword, or branded term, put it in **Markdown bold** (`**like this**`), especially as the bullet label (`* **motorized blinds calgary:**` sentence…). **Never** wrap keywords in straight double quotes, straight single quotes, or curly quotes. **Forbidden output:** decorative quoting around the keyword text. **Required:** **term** or plain term without quotes.";

const PROFESSIONAL_EXECUTIVE_BULLETS =
  "**PROFESSIONAL BULLET NARRATIVE (mandatory):** After **1 short framing paragraph** (2–4 sentences), write **5–8** markdown bullets. Format: `* **Bold label:**` then **one complete sentence** with **specific metrics** from RETRIEVED DATA (clicks, impressions, users, average position, key events, key event rate) in the sentence or parentheses. **Use `* ` list markers only (never `- `).** The **Bold label** is the query, theme, month, or segment name in **bold only** (see KEYWORD rule). Explain **what it means for the client** (visibility, intent, opportunity, local reach). **Forbidden:** a single total sentence with no bullets; **Forbidden:** pasting harness rules or internal disclaimers as bullets; **Forbidden:** any quotation marks around keyword or query text. **Top lists:** discuss **only** rows present in injected tables (top **10** queries / Semrush keywords max).";

const GSC_REPORT_UNORDERED_LIST_FORMAT =
  "**UNORDERED LISTS (mandatory):** Every insight list uses **asterisk bullets only**: `* **Label:**` full professional sentence. **Forbidden:** `- ` dash bullets, numbered lists, and mixed markers in one section.";

const POSITION_VS_IMPRESSIONS_CONTEXT =
  "**POSITION VS IMPRESSIONS:** In GSC, **lower** average position is better. When impressions rose sharply and average position worsened on the **same query or site slice**, treat that as **expanded search footprint** (Google showed the site for more searches or variants), not as a visibility collapse. Lead with impression and discovery language; position is secondary context.";

/** Block recomputed or stray CTR claims outside the site KPI table. */
const CTR_DISCIPLINE =
  "**CTR DISCIPLINE:** **Site-wide** CTR appears **only** in **Search Performance Compared Month Over Month** (table + short prose there). In **all other sections**, do **not** mention **CTR** or **CTR Δ%** for queries, pages, or segments unless that **exact** CTR value appears in **RETRIEVED DATA** on the **same** row you are discussing (same digits, Canadian grouping; **no** recomputation). **Do not** add a **CTR** column to theme tables outside Search Performance unless the source CSV row includes CTR.";

const TABLE_RULE =
  `Use GFM pipe tables only when needed: header row, separator \`|:---|\`, data rows. ${TABLE_HEADER_ABBREV} **Max 6 data rows** per table. ${TABLE_RULE_SITE_MOM} ${TABLE_RULE_THEME_DELTA} ${THEME_ROW_INTEGRITY} ${DIRECTIONAL_LANGUAGE} ${CTR_DISCIPLINE} **One numeric metric per cell:** **never** put multiple stats in **one** cell or in a prose **Summary / Direction** column. **Forbidden:** comma-joined metric bundles. **Forbidden table shapes:** Do **not** duplicate **Search Performance** as a second full MoM grid in other sections. **TABLE DATA (strict):** Every cell grounded in RETRIEVED DATA (and **OUTLINE_GROUNDING** when present). **Forbidden:** “Not Available”, “N/A”, blanks for metrics. **Forbidden:** a pipe table that has **only** a header row and separator with **zero** data rows (omit the table). **Omit** incomplete rows. **URL columns:** \`[short label](url)\`. **Sort** URL rows by clicks ↓ then impressions ↓ only if not using **theme buckets** (default: **theme buckets**). **Do not** include rows where **both** impressions and clicks are **0**.`;

/** GSC position: lower numeric rank is better. */
const POSITION_LEXICON =
  "**AVERAGE POSITION:** In Google Search Console, **lower** average position is **better** (closer to 1). After the KPI table, include **one** short sentence stating this for the executive reader. Your verbal summary of **Pos Δ%** must match the **sign** shown in the CSV (**do not** invert improvement vs decline).";

const KEY_INSIGHTS_DIVISION =
  "**SECTION DIVISION (NO REDUNDANCY):** Prefer **prose-only** interpretation (risks, opportunities, what changed for the business). **Forbidden:** opening by restating total clicks, impressions, search queries, CTR, or average position **and** their MoM **%** (that is **only** in **Search Performance Compared Month Over Month**). **Forbidden:** paraphrasing the Executive Summary lead paragraph. If you include **one** theme table, **≤6 data rows**, **THEME ROW INTEGRITY** applies; the table must **add** something (e.g. different slice or framing), **not** a second copy of the same top-query grid with identical figures.";

const SAP_CONTENT_APPEND =
  "**AFTER THE TABLE:** At most **≤3** short bullets **or** **≤3** sentences of prose (not both long bullets and long prose). **Forbidden:** pseudo-headings or bold labels **Key Insights**, **Observations**, **Top themes** as section breaks. **Forbidden:** query-level **CTR Δ%** or any **%** not traceable to **RETRIEVED DATA** for that segment. **No** second pipe table. **No** `###` / `####`.";

/** SAP / Content must not replay site KPIs or duplicate query tables from earlier sections. */
const SAP_CONTENT_NO_REDUNDANCY_CORE =
  "**NO REDUNDANCY:** **Do not** repeat the site-wide KPI totals or their MoM **%** here. **Do not** paste another **Theme | Clk | Clk Δ% | Imp | Imp Δ%** query grid that duplicates the same lines as **Key Performance Insights** (if that section already showed one).";

const CONTENT_FOOTPRINT_SEGMENT_LENS =
  "**Content section:** Stay in **segment** lens (**Segment | Clk | Imp | Pos**): thematic content footprint **only**, with prose that **adds** insight rather than restating earlier paragraphs. **No** **Inc** / **Includes** column.";

/** Group Pages URLs by submitted sitemap / URL archetype (blogs, local, products, etc.). */
const CONTENT_PERFORMANCE_SITEMAP_BUCKETS =
  "**Sitemap-style buckets (mandatory):** Read **GSC-sitemaps.csv** for submitted child sitemap **paths** (e.g. `post-sitemap`, `page-sitemap`, `product`, `category`, `location`, `local`, `service-area`, `photo-gallery`, `near`, `news`) **only to assign buckets**. Build **4–6** **Segment** rows that mirror those **content-type families**, not random themes. Prefer labels such as **Blog & editorial** (posts / articles), **Core pages & marketing** (static pages, homepage hub), **Products & catalog** (product, shop, WooCommerce-style paths), **Local & near-me landings** (location, local, service-area, geo-style URLs when they are **not** the SAP entity-exclusive slice), **Galleries & media**, **Other URLs**. Assign each **Pages-MoM.csv** URL to **one** bucket using pathname cues plus **GSC-sitemaps.csv** naming; **omit** empty buckets. **Do not** replay per-URL MoM grids. **Forbidden in the table:** sitemap file stems, an **Inc** / **Includes** column, or any cell that lists `post-sitemap` / `page-sitemap` / similar.";

/** Allows summed metrics per Segment row for Content Performance (exception to global one-row theme rule). */
const CONTENT_SEGMENT_BUCKET_OVERRIDE =
  "**SEGMENT AGGREGATES (this section only):** **THEME ROW INTEGRITY** does **not** apply to **Segment** rows here, and the **AGGREGATION** line in **EXEC_RULES** (**one CSV row per theme row**) does **not** apply here. Each **Segment** row is a **bucket** of many page URLs. **Sum** **Clk** and **Imp** across **all** Pages-MoM rows you assign to that bucket (use the CSV period columns). Write those sums with **NUMBER FORMAT** (exact integer totals, no **+** suffix). When you show **Clk Δ%** / **Imp Δ%**, compute from those **bucket totals** vs prior period using the **same % formula** as the sheet. **Pos:** copy the **exact** average position from the **single** highest-**Imp** row in that bucket (same digits as CSV, no **+**). **No** invented averages. **No** extra columns. **If** you cannot sum a bucket exactly from visible rows, **omit** that segment row.";

/** When pipeline pins entity allowlist + filtered Pages, writers must obey those blocks over stray CSV excerpts. */
const SAP_RETRIEVED_ENTITY_BLOCKS =
  "**ENTITY BLOCKS (when present in RETRIEVED DATA):** If you see `ENTITY_SITEMAP_ALLOWLIST` or `FILTERED_PAGES_FOR_SAP`, those blocks are **authoritative** for SAP URL scope. **Ignore** any other Pages MoM rows elsewhere in RETRIEVED DATA for the SAP **Page** table. **Do not** paste **query strings** as SAP table rows and **do not** add after-table bullets about named queries (that belongs in query sections). Metrics for SAP rows must come from **FILTERED_PAGES_FOR_SAP** when that block lists matching URLs; otherwise follow **ENTITY_SITEMAP_ALLOWLIST** and omit metrics you cannot trace. **Never write those block names in the report**; say **the site's data**.";

/** SAP & Local SEO: entity sitemap URLs only, not blog/editorial Pages export leaders. */
const SAP_ENTITY_SITEMAP_LAYOUT =
  "**SAP & LOCAL SEO = LOCAL SERVICE AREA + ENTITY PAGES:** Report **only** URLs on **ENTITY_SITEMAP_ALLOWLIST**: **local service area** landings (city/area pages such as Cochrane, Airdrie, Okotoks, Canmore under `/location/` or `/service-area/`) **and** **entity sitemap** destinations from the WordPress entity/local XML sitemaps. Column **Page** = **`[short label](full URL)`**; metrics must match **one** page row in **RETRIEVED DATA** for that URL. **Strictly excluded:** homepage, blog posts, **vs** articles, generic repairs/education hubs, retail-store pages, and any URL **not** on the allowlist. **Do not** use **Queries** as row labels. **If** no allowlisted URLs, state that briefly and omit the table. **Exactly one** table via **FIXED TABLES**. **≤6** rows. **Forbidden:** CMS duplicate paths `-2`…`-30`. Prose highlights **local area** performance where clicks/impressions exist (no query-theme recap).";

const SAP_LOCAL_TABLE_MIN =
  "**TABLE (SAP only):** **One** pipe table only; **max 6** data rows; numbers matching CSV values with Canadian grouping; **no** N/A or blank metric cells when the CSV has values; **no** header-only tables; **no** split tables or duplicate headers.";

function buildOutlineGroundingBlock(outline: GscReportingOutlineResult): string {
  const rows = outline.topOpportunities;
  if (!rows.length) return "";
  const lines: string[] = [
    "OUTLINE_GROUNDING (from outline step; evidence lines are verbatim CSV supports):",
    "",
  ];
  for (const t of rows) {
    lines.push(`- rank ${t.rank}: **${t.label}**`);
    lines.push(`  - why: ${t.why}`);
    lines.push(`  - metrics: ${t.metrics}`);
    const ev = t.evidence ?? [];
    if (ev.length) {
      lines.push("  - evidence (verbatim):");
      for (const e of ev) {
        lines.push(`    - ${e}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/** Page-heavy sections (SAP, top pages): theme rows with one metric per column (no “high-level result” blobs). */
const PAGE_THEMATIC_LAYOUT =
  "**Thematic page groups (mandatory):** Do **not** list **one row per URL** and **never** a **7+ column** Mar/Feb/Δ% grid for pages - that is **not** executive-readable. **Do** use **4–6 theme rows max** (e.g. **Homepage & brand**, **Product / solutions**, **Service-area (regional)**, **Blog / resources**). Each row = **one business segment**, not one URL. **Table columns (mandatory):** **Segment** | **Clk** | **Imp** | **Pos** - **four columns total**, abbreviated metric headers (**Clk**, **Imp**, **Pos**). **Forbidden:** an **Inc** / **Includes** column, sitemap file stems in cells, a **Notes** column, or any fifth dimension column. **One** number or **one** % change per cell, never combined. **Forbidden:** any column titled **High-level result**, **Summary**, or **Direction** that mixes multiple metrics in prose. **Forbidden:** typing \"High impressions, zero clicks\" **and** the counts in the same cell - put **244** under **Imp**, **0** under **Clk**, etc. **Never** mention or link CMS duplicate paths ending in `-2`…`-30`. Optional **≤2** example page links in prose **below** the table only. **One table only**. **Omit** low-signal buckets.";

/** Content Performance: prefer sitemap-derived segment names over generic examples. */
const PAGE_THEMATIC_LAYOUT_CONTENT =
  "**Combined stages (Content Performance):** Same table shape as thematic page groups (**Segment | Clk | Imp | Pos**). **Segment** labels must follow **sitemap / content-type families** from **GSC-sitemaps.csv** (see **Sitemap-style buckets** above), not generic examples alone. Still **do not** list **one row per URL**. **Do not** output sitemap names or an **Inc** column.";

/** Cluster sections: executive scannability - tables only, no bullet/numbered lists. */
const CLUSTER_TABLE_ONLY_LAYOUT =
  "CLUSTER LAYOUT (mandatory): Do **not** use bullet lists (`-`, `*`) or numbered lists (`1.`). Optional: at most **one** short intro sentence (no list). Then use **only** GFM pipe tables - up to **3** compact tables: (1) **Cluster metrics** - columns **Metric | Value** (metric names in first column may be short phrases; rows e.g. Total Clk, Total Imp, CTR, Pos) from RETRIEVED DATA. (2) **Example queries or pages** - headers **Example | Imp | Clk | Pos** (abbreviated; omit columns if unsupported); ≤5 example rows, plain text or **bold** for emphasis in cells (**no** quote wrapping around queries or titles); **sort** pages by Clk ↓ then Imp ↓, queries by Imp ↓ then Clk ↓; **omit** rows with 0 Imp **and** 0 Clk. (3) **Takeaways** - columns **Topic | Insight** (1–3 rows: opportunity, relevance, or implication).";

function baseWithExec(opts?: { seasonOnce?: boolean }): string {
  const seasonRule = opts?.seasonOnce ? GSC_SEASONAL_CONTEXT_RULE : GSC_NO_SEASON_REPEAT_RULE;
  return `ROLE: SEO strategist writing for a **time-poor executive**. OUTPUT: Markdown only (no HTML). **Brevity beats completeness.** ${REPORTING_ENGLISH_PROSE_RULES} ${GROUNDING_RULE_WITH_OUTLINE} ${CLIENT_FACING_DATA_LANGUAGE} ${KEYWORD_BOLD_NOT_QUOTES} ${GSC_REPORT_UNORDERED_LIST_FORMAT} ${seasonRule} ${NUMBER_FORMAT_CA} ${COMPARE_SIGNALS_LEXICON} ${QUERY_SPOTLIGHT_LEXICON} ${POSITION_VS_IMPRESSIONS_CONTEXT} **Tables:** every number from RETRIEVED DATA (and **OUTLINE_GROUNDING** when present); **no** placeholders; **skip** bad rows. **Do not invent** metrics. First line = exact H2 from user message. No H1. ${EXEC_RULES}`;
}

/** Executive Summary ### Key Insights: strategic themes, not a query-by-query inventory. */
const EXEC_KEY_INSIGHTS_BREADTH =
  "**KEY INSIGHTS ALTITUDE:** Write **portfolio-level** bullets for a busy executive: **themes** such as branded visibility, content categories, or impression-vs-click quality. **Do not** build bullets around **individual** long-tail queries or blog titles unless **one** optional example stands for a whole bucket. **Avoid** celebrating **noise-level** moves (very low prior-period clicks where **%** is misleading, e.g. 1→2). **Prefer** qualitative synthesis; when you use numbers, tie them to a **segment** or pattern supported by **OUTLINE_GROUNDING** / **RETRIEVED DATA**. **At most one** concrete query or page name **in the entire Key Insights block** (optional). **Do not** stack several granular examples in one bullet.";

/** Appended to every section user message for consistent tone. */
export const GSC_REPORTING_SECTION_STYLE_LINE =
  "Style: **Senior exec** - **short** prose first when helpful; **at most one** slim table per section; **never** repeat a giant Mar-vs-Feb per-page grid; **page sections:** **theme segments only**; **query sections:** **categories** as **theme rows**. **Tables:** Abbreviated headers (**Clk**, **Imp**, **Pos**, **CTR**, **Δ%**) on every metric column. **Search Performance Compared Month Over Month** is the **only** section with the full site KPI table (same logic as CSV; **short** metric headers in the markdown). **Do not** repeat that site-wide story or duplicate the same query-theme table in later sections. **Everywhere else** (themes, categories, insights): **Theme | Clk | Clk Δ% | Imp | Imp Δ%** (optional **Pos | Pos Δ%**) - **no** Mar/Feb/Δ triplets, **no** 10-column query MoM layouts; **no** `###` subheadings; **never** one column with comma-joined stats; no placeholder cells; **`[short name](url)`** links; **no** quotation marks around queries, keywords, or titles (use **bold** for emphasis only). **Never** paste or link URL paths ending in `-2`…`-30` (CMS duplicates); use themes or canonical pages only. When **OUTLINE_GROUNDING** is present: follow **NUMERIC GROUNDING** in the system prompt. **Never name internal data in the report; write the site's data.**";

/** Executive summary: one explainer paragraph + ### Key Insights + positive bullets (see pipeline H1 + no URL/source line in output). */
export const GSC_REPORTING_EXEC_SUMMARY_STYLE_LINE =
  `Style (this section only): **Structure (mandatory):** (1) **One short explainer paragraph** (2–4 sentences): the **first sentence must name the exact REPORT_PERIOD date range** (copy it verbatim, e.g. April 1, 2026 to April 30, 2026). **When GA organic traffic metrics appear in RETRIEVED DATA:** the **second sentence** must state **Organic sessions** for the period (include MoM **%** from GA; use **traffic** / **sessions** wording). **GSC** clicks and impressions are **search visibility**, not website traffic - **never** open with GSC clicks/impressions as if they were traffic. **include exactly one sentence** that uses the word **seasonality** and says **busy** or **not busy** for the **full REPORT_PERIOD** from **CLIENT_SEASON** (not only the first month; not today's calendar); **do not** say **shoulder**, **peak**, or **slow**; **do not** repeat seasonality in Key Insights or later; **bold** 1–2 scan phrases (e.g. **Organic traffic**, **Search visibility**); defer the full GSC KPI table to **Search Performance Compared Month Over Month**. **NUMERIC GROUNDING:** Any number or **%** in this paragraph must match **RETRIEVED DATA** or **OUTLINE_GROUNDING** (same digits, Canadian grouping); otherwise omit the figure or stay qualitative. (2) A blank line, then **exactly** this heading: \`### Key Insights\` (H3, no other H3). (3) **4–5** Markdown list bullets; each line **Bold label:** one scannable insight; **no** **Season:** bullet (seasonality is already in the explainer). **every** bullet that includes **any** digit or **%** must map clearly to **one** outline opportunity or **one** evidence line in **OUTLINE_GROUNDING**, or to a line in **RETRIEVED DATA** (same query/page token and same figures). **No** new math or invented URL/query stats. **Direction:** apply **DIRECTIONAL LANGUAGE** from the system prompt (no growth wording for flat or negative **Clk Δ%** / **Imp Δ%**). **Do not** wrap query or page names in quotation marks; use **bold** when highlighting a specific term. ${EXEC_KEY_INSIGHTS_BREADTH} Keep tone **constructive**; **no** pipe tables; **no** task lists. **Never name internal data in the report; write the site's data.**`;

export const GSC_REPORTING_EXEC_SUMMARY_PERIOD_PROGRESS_STYLE_LINE =
  `Style (this section only): **Structure (mandatory):** (1) **One short explainer paragraph** (2–4 sentences): **first sentence** names **REPORT_PERIOD** verbatim. **When GA Organic Search Traffic acquisition by month is in RETRIEVED DATA:** **second sentence** states **period total Organic Search sessions** (digits from CSV). **MATTER-OF-FACT:** no increase/decrease or month-over-month direction for traffic or visibility. **One seasonality sentence** from **CLIENT_SEASON** (**busy** or **not busy**). **GSC** is search visibility only. (2) Blank line, **\`### Key Insights\`**. (3) **5–7** bullets: **Bold label:** full sentence each, with metrics; professional tone like Key Performance Insights. **No** pipe tables. ${EXEC_KEY_INSIGHTS_BREADTH} **Never name internal data in the report; write the site's data.**`;

const GA_WEBSITE_TRAFFIC_PERIOD_SYSTEM = `You write one section of a client SEO report. OUTPUT: GitHub-Flavored Markdown prose only (no HTML). First line = exact Target H2 from the user message. No H1. ${REPORTING_ENGLISH_PROSE_RULES} ${NUMBER_FORMAT_CA}

SECTION: Website Traffic From Organic Search (period progress report)

SOURCE: GA4 **Traffic acquisition → Organic Search** (sessionDefaultChannelGroup). Every number must match **RETRIEVED DATA**. Ignore any outline, opportunities, or search-query context if it appears elsewhere in the user message.

OUTPUT (mandatory): **Exactly one paragraph** (2–4 sentences). Include **period total Organic Search sessions**, **engaged sessions**, and **key events**. You may end with one short sentence that the month-by-month Traffic acquisition table is below (no metrics in that sentence).

FORBIDDEN in this section: bullet or numbered lists; lines starting with * or -; **Bold label:** insight rows; search queries or query themes; page titles or blog topics; GSC clicks, impressions, CTR, or position; naming individual months with user counts; pipe tables; ### subheadings; opportunities or keyword strategy copy.`;

const GA_WEBSITE_TRAFFIC_PERIOD_USER_STYLE =
  "Write **one paragraph only** for period Organic Search traffic (GA4 Traffic acquisition). **No lists.** **No queries, pages, or themes.** The app injects the Organic Search traffic acquisition table after your paragraph.";

/** Period-progress reports: website traffic = GA only; no GSC site-wide totals tables anywhere. */
const PERIOD_PROGRESS_NO_GSC_SITE_TOTALS =
  "**Period progress (mandatory):** **Website traffic** = **GA4 Organic Search** only (**Website Traffic From Organic Search** section). **GSC site-wide totals tables are forbidden** in the client report: **no** **Site search totals (GSC)**, **no** **Site search totals by month (GSC)**, **no** pipe table of month-by-month GSC clicks/impressions/CTR/position. Search visibility = **Queries-Period.csv** and the injected **Top search queries** table under **Search Performance This Period** only.";

const FIXED_TABLES_USER_BLOCK =
  "**FIXED TABLES (mandatory in your section output):** Copy the block below **verbatim** after your prose (same pipes, numbers, and links). **Do not** author a different pipe table.";

export function buildUserMessageForSection(args: {
  siteName: string;
  siteUrl: string;
  outline: GscReportingOutlineResult;
  plan: GscReportingSectionPlan;
  retrievedContext: string;
  clientSeason?: GscClientSeasonContext | null;
  compareLabel?: string;
  compareKind?: GscCompareKind;
  /** Pre-built GFM tables the model must paste verbatim (SAP, Search Performance, etc.). */
  fixedTablesMarkdown?: string;
}): string {
  const { siteName, siteUrl, outline, plan, retrievedContext, clientSeason } = args;
  const compareKind = args.compareKind ?? "mom";
  const compareLabel = args.compareLabel?.trim() ?? "";
  const reportPeriod = formatGscReportTitlePeriod(compareLabel);

  const clusterHint =
    plan.kind === "cluster" && plan.clusterIndex != null && outline.clusters[plan.clusterIndex]
      ? JSON.stringify(outline.clusters[plan.clusterIndex], null, 0)
      : "";

  const execHint = plan.kind === "executive_summary" ? outline.executiveSummary.slice(0, 2000) : "";

  const parts: string[] = [
    `Property: ${siteName}`,
    `URL: ${siteUrl}`,
    `Section kind: ${plan.kind}`,
    `Target H2 (output this exact heading as the first line): ## ${plan.h2Title}`,
  ];
  parts.push("");
  if (plan.kind === "executive_summary") {
    const season = applyReportPeriodToClientSeason(clientSeason ?? emptyGscClientSeasonContext(), compareLabel);
    parts.push(formatGscClientSeasonPromptBlock(season));
    if (reportPeriod) {
      parts.push(
        `REPORT_PERIOD (copy this exact current-period range into the first sentence of the explainer paragraph; do not substitute another month): ${reportPeriod}`,
      );
    }
  }
  if (plan.kind === "executive_summary" && compareKind === "period_progress") {
    parts.push(
      "**Period progress source split:** Lead website **traffic** with **GA4 Organic Search Traffic acquisition by month** when that GA CSV is in RETRIEVED DATA. Use **GSC** only for search clicks, impressions, queries, and position. **MATTER-OF-FACT:** no increase/decrease language for monthly figures.",
    );
  }
  if (
    plan.kind === "key_performance_insights" ||
    plan.kind === "sap_local_seo" ||
    plan.kind === "content_performance"
  ) {
    parts.push(
      "Report context (NO REDUNDANCY): Sections above this in the final report already include Executive Summary and Search Performance Compared Month Over Month with the **only** site-wide KPI table. Do **not** repeat that table, do **not** restate the same site-wide KPI totals (clicks, impressions, search queries, CTR, position) with MoM %, and do **not** paste a second query/theme MoM grid that duplicates the same rows and figures as an earlier section.",
    );
  }
  if (plan.kind === "website_traffic_acquisition" && compareKind === "period_progress") {
    parts.push(
      "**This section is GA website traffic only.** Do not use search queries, query themes, page URLs, blog titles, or outline opportunities. **One paragraph** with period totals (total users, new users, user key event rate, key events) from GA data below. **No bullet lists.**",
    );
  } else if (plan.kind === "website_traffic_acquisition") {
    parts.push(
      "**GA organic traffic contract:** Ground narrative in the GA4 Organic Search MoM data in RETRIEVED DATA. **Do not** output a pipe table in this section (the report appends a fixed **Organic Search traffic acquisition** table). **Do not** cite GSC clicks or impressions as session counts. **Do not** name CSV filenames; write **website analytics** or **organic search traffic**.",
    );
  }
  if (plan.kind === "executive_summary" && compareKind === "period_progress") {
    parts.push(
      "**Cross-source rule:** **GA** = **total users** (organic medium) for traffic; **GSC** = search visibility only. **Executive Summary:** if GA is present, state **period total organic users** and **matter-of-fact** monthly facts only (no increase/decrease wording).",
    );
  } else if (plan.kind === "executive_summary" || plan.kind === "key_performance_insights") {
    parts.push(
      "**Cross-source rule:** When GA organic traffic metrics appear in RETRIEVED DATA, treat **GA** as source of truth for **on-site sessions and engagement**; treat **GSC** CSVs as source of truth for **search clicks, impressions, queries, CTR, and average position**. Do not swap or blend sources. **Executive Summary:** if GA is present, paragraph 1 must include **Organic sessions** with MoM **%** before any GSC visibility figures.",
    );
  }
  if (plan.kind === "sap_local_seo") {
    parts.push(
      "**SAP section contract:** **Local service area + entity URLs** on **ENTITY_SITEMAP_ALLOWLIST** (entity XML sitemap plus local landings under `/location/` and `/service-area/`, including city pages like Cochrane and Canmore). **Strictly excluded:** homepage, blog, **vs** articles, repairs hubs, and URLs not on the allowlist. Discuss **only** allowlisted local/entity pages in prose. **No** query-theme recap. **Never** write block names in the report.",
    );
    if (args.fixedTablesMarkdown?.trim()) {
      parts.push("");
      parts.push(FIXED_TABLES_USER_BLOCK);
      parts.push("");
      parts.push(args.fixedTablesMarkdown.trim());
    }
  }
  if (plan.kind === "content_performance") {
    parts.push(
      "**Content Performance contract:** One table with columns **Segment | Clk | Imp | Pos** only (no **Inc** / **Includes** column). Group **Pages-MoM.csv** URLs into **sitemap-style buckets** using **GSC-sitemaps.csv** paths. **Every table cell** = **exact** number from summed or copied CSV values (no **+**, no ~rounded thousands). **Do not** print sitemap file stems. **Do not** duplicate SAP or query-theme grids.",
    );
  }
  if (plan.kind === "cluster" && clusterHint) {
    parts.push(`Cluster metadata (ground prose in RETRIEVED DATA): ${clusterHint}`);
    parts.push("Cluster section: output tables only (metrics, examples, takeaways) - no bullet or numbered lists.");
  }
  if (plan.kind === "executive_summary" && execHint) {
    parts.push(`Outline executive summary (align narrative; ground numbers in RETRIEVED DATA or OUTLINE_GROUNDING): ${execHint}`);
  }
  if (plan.kind !== "website_traffic_acquisition") {
    const groundingBlock = buildOutlineGroundingBlock(outline);
    if (groundingBlock) {
      parts.push("");
      parts.push(groundingBlock);
    }
  }
  parts.push("");
  parts.push(
    plan.kind === "website_traffic_acquisition"
      ? "RETRIEVED DATA (GA4 Organic Search Traffic acquisition only):"
      : "RETRIEVED DATA (GA organic traffic and GSC CSV excerpts - ground numbers and examples in this text):",
  );
  parts.push(retrievedContext);
  parts.push("");
  parts.push(
    plan.kind === "executive_summary"
      ? compareKind === "period_progress"
        ? GSC_REPORTING_EXEC_SUMMARY_PERIOD_PROGRESS_STYLE_LINE
        : GSC_REPORTING_EXEC_SUMMARY_STYLE_LINE
      : plan.kind === "website_traffic_acquisition"
          ? compareKind === "period_progress"
            ? GA_WEBSITE_TRAFFIC_PERIOD_USER_STYLE
            : `${GSC_REPORTING_SECTION_STYLE_LINE} **GA override:** Sessions and engagement from GA organic CSV only; no GSC click/impression mix-in; see system prompt.`
          : plan.kind === "sap_local_seo"
          ? `${GSC_REPORTING_SECTION_STYLE_LINE} **SAP override:** Use the entity allowlist and filtered page rows when present; **never** name those blocks in output (write **the site's data**); **no** query-theme recap; **one** **Page** table; see system prompt.`
          : plan.kind === "content_performance"
            ? `${GSC_REPORTING_SECTION_STYLE_LINE} **Content override:** **Segment | Clk | Imp | Pos** only; **no** **Inc** column; **no** sitemap file names in cells; see system prompt.`
            : GSC_REPORTING_SECTION_STYLE_LINE,
  );
  return parts.join("\n");
}

export function getGscReportingSectionSystemPrompt(
  kind: GscReportingSectionPlan["kind"],
  compareKind: GscCompareKind = "mom",
): string {
  const base = baseWithExec({ seasonOnce: kind === "executive_summary" });
  const searchPerformanceH2 = searchPerformanceH2ForCompareKind(compareKind);
  const periodCompareWording =
    compareKind === "period_progress"
      ? "within this period (month to month)"
      : compareKind === "yoy"
        ? "year over year"
        : compareKind === "custom"
          ? "period over period"
          : "month over month";

  switch (kind) {
    case "executive_summary":
      if (compareKind === "period_progress") {
        return `${base} ${PERIOD_PROGRESS_NO_GSC_SITE_TOTALS} ${PERIOD_PROGRESS_MATTER_OF_FACT} ${PROFESSIONAL_EXECUTIVE_BULLETS} ${EXEC_KEY_INSIGHTS_BREADTH} SECTION: Executive Summary (period progress) - **GA vs GSC (mandatory):** **GA-Organic-Search-Traffic-Acquisition-By-Month.csv** is the **only** source for **website traffic** (**Organic Search sessions**, GA4 Traffic acquisition). **GSC** files are **search visibility** only. **Forbidden:** GSC clicks/impressions as traffic or sessions; **forbidden:** any GSC site-wide totals table or month-by-month GSC KPI grid. **When GA monthly CSV is present:** open with **period total Organic Search sessions** for **REPORT_PERIOD** (from the CSV totals block). **Forbidden words:** progress, MoM vs last month, period B, vs August, quarter over quarter, and all directional words in **PERIOD_PROGRESS_MATTER_OF_FACT**. **Output shape:** (1) Explainer naming **REPORT_PERIOD**; one **seasonality** sentence from **CLIENT_SEASON**. (2) \`### Key Insights\`. (3) **5–7** professional bullets under Key Insights. **No** pipe tables.`;
      }
      return `${base} ${DIRECTIONAL_LANGUAGE} ${EXEC_KEY_INSIGHTS_BREADTH} SECTION: Executive Summary - **No** site-wide KPI table here (that lives **only** in **${searchPerformanceH2}**). **GA vs GSC:** When GA organic acquisition data is in RETRIEVED DATA, **Organic sessions** (and MoM **%**) are the **website traffic** headline; GSC clicks/impressions are **search visibility** only - **forbidden** to describe GSC click or impression change as organic traffic or sessions. **Output shape (mandatory order):** (1) **One** short explainer paragraph: **first sentence names the exact REPORT_PERIOD date range** from the user message; **with GA present, second sentence states Organic sessions MoM**; then search visibility in plain language if needed; **include exactly one sentence** that uses the word **seasonality** and says **busy** or **not busy** for the full REPORT_PERIOD from **CLIENT_SEASON**; **do not** say **shoulder**, **peak**, or **slow**; **do not** name a different month than REPORT_PERIOD; **do not** repeat seasonality after that sentence; **bold** 1–2 key phrases; **defer** the full GSC KPI table to **${searchPerformanceH2}**. Obey **COMPARE_SIGNALS** when present for **visibility** wording only (do not override GA session direction). (2) Blank line, then heading **exactly** \`### Key Insights\` (H3 only; **no** other subheadings). (3) **4–5** bullets: each * **Label:** scannable insight; **no** **Season:** bullet. Bullets with numbers must trace to **OUTLINE_GROUNDING** (if present) or **RETRIEVED DATA**. **No** pipe tables; **no** priority/next-step lists.`;
    case "website_traffic_acquisition":
      if (compareKind === "period_progress") {
        return GA_WEBSITE_TRAFFIC_PERIOD_SYSTEM;
      }
      return `${base} SECTION: Website Traffic From Organic Search - **GA4 Organic Search only** (not site total sessions, not Direct or Paid). **Output:** **one** short paragraph on **organic sessions** MoM and engagement (engaged sessions, engagement rate, key events) grounded in RETRIEVED DATA. **No** pipe tables in this section (a fixed Organic Search traffic acquisition table is injected after generation). **Forbidden:** GSC clicks or impressions as session counts; **forbidden:** other channel groups. ${TABLE_RULE}`;
    case "search_performance_period":
      if (compareKind === "period_progress") {
        return `${base} ${PERIOD_PROGRESS_NO_GSC_SITE_TOTALS} ${PERIOD_PROGRESS_MATTER_OF_FACT} ${POSITION_LEXICON} SECTION: Search performance within this period - **GSC keywords and visibility only** (Queries-Period.csv). **Do not** cite GA sessions here. **No pipe tables** in your output. The app injects **only** **Top search queries** (top **10**). **Forbidden:** any **Site search totals** GSC block (by month or otherwise); **forbidden:** month-by-month GSC clicks/impressions/CTR/position tables; **forbidden:** authoring or duplicating site-wide GSC KPI tables. **Forbidden:** prior period block compare, vs last year, **traffic** or **sessions** wording, directional language from **PERIOD_PROGRESS_MATTER_OF_FACT**, **bullet lists**, and **numbered lists**. **Output:** **One short paragraph only** (2–4 sentences) on search visibility for **REPORT_PERIOD**; you may name queries in prose without metric line blocks. Query-level metrics belong in the injected **Top search queries** table only.`;
      }
      return `${base} ${PROFESSIONAL_EXECUTIVE_BULLETS} ${POSITION_LEXICON} SECTION: Search performance ${periodCompareWording} - **No pipe tables** in your output. ${TABLE_RULE_SITE_MOM} The app also injects **Top search queries** (top **10** by clicks, highest first). **Output shape (mandatory):** (1) **2–3 sentences** on site-wide visibility grounded in **RETRIEVED DATA** (include **COMPARE_SIGNALS** when present). (2) **5–8 insight bullets** after the injected tables: each * **Label:** one interpretive sentence with metrics. **Forbidden:** \`###\` / \`####\` subheadings; **forbidden:** naming a query on its own line then metric bullets (**Clk:**, **Imp:**, **Pos:**); **forbidden:** repeating table numbers row-by-row. Query metrics live in the injected table only. **Do not** put month or date ranges in the H2. **Do not** say "month over month" when compareKind in **COMPARE_SIGNALS** is **yoy** or **custom**.`;
    case "key_performance_insights":
      return `${base} ${PROFESSIONAL_EXECUTIVE_BULLETS} ${KEY_INSIGHTS_DIVISION} SECTION: Key performance insights - **No** \`###\` / \`####\` subheadings (only the single **Target H2**). **Primary format:** **5–8 professional bullets** (* **Theme or query label:** full sentence with metrics). **Asterisk bullets only.** **Optional:** one short intro paragraph before bullets. Obey **COMPARE_SIGNALS** when present. **Discuss only top query/theme rows** from RETRIEVED DATA (cap **10** named queries across the section). **Forbidden:** URL-level compare grids (no duplicate of **${searchPerformanceH2}**). **Optional one theme table:** **Theme | Clk | Clk Δ% | Imp | Imp Δ%**; **≤6 data rows**; never header-only tables. **Forbidden:** **Next steps** / task backlogs. ${TABLE_RULE}`;
    case "seasonal_demand":
      return `${base} ${TABLE_RULE}`;
    case "sap_local_seo":
      return `${base} ${SAP_CONTENT_NO_REDUNDANCY_CORE} ${SAP_RETRIEVED_ENTITY_BLOCKS} ${SAP_ENTITY_SITEMAP_LAYOUT} ${SAP_CONTENT_APPEND} SECTION: SAP & local SEO - **Local service area and entity page performance.** **Output order (mandatory):** (1) **1–2 short paragraphs** on **local area** pages (city/area landings with clicks/impressions) **and** entity sitemap URLs from **ENTITY_SITEMAP_ALLOWLIST** / **FIXED TABLES** only. (2) Copy **FIXED TABLES** verbatim (**### Local and entity pages**). (3) Optional **≤4** bullets after the table, allowlisted URLs only. **Forbidden:** your own \`| Page |\` table; homepage, blog, **vs** articles, repairs hubs unless on allowlist; query-theme bullets from other sections.`;
    case "content_performance":
      return `${base} ${SAP_CONTENT_NO_REDUNDANCY_CORE} ${CONTENT_FOOTPRINT_SEGMENT_LENS} ${CONTENT_PERFORMANCE_SITEMAP_BUCKETS} ${PAGE_THEMATIC_LAYOUT_CONTENT} SECTION: Content / top pages - ${PAGE_THEMATIC_LAYOUT} ${CONTENT_SEGMENT_BUCKET_OVERRIDE} ${SAP_CONTENT_APPEND} **Forbidden:** per-page MoM comparison grids (multiple month columns + Δ% per URL). **Output:** optional **one** short intro paragraph, then **one** **Segment | Clk | Imp | Pos** table (**max 6 rows**). Table metrics must be **exact** totals from RETRIEVED DATA (**never** 6,000+ or 20.00+ style rounding). Optional **≤3** bullets after the table only if they add insight **without** repeating table numbers. ${TABLE_RULE}`;
    case "cluster":
      return `${base} ${CLUSTER_TABLE_ONLY_LAYOUT} ${TABLE_RULE} SECTION: One topic cluster - follow CLUSTER LAYOUT above; no lists anywhere in this section.`;
    default:
      return `${base} ${TABLE_RULE}`;
  }
}
