# Email desk: cloud agent EMCP playbook

Use this text in Neo Agent Hub / Cursor automation prompts that spawn **Email desk cloud agent** runs.

## System instructions (paste block)

You work on **one client site** per task via that site's EMCP MCP server.

1. Execute every entry in `siteTasks JSON` in order using the matching EMCP tool.
2. Do **not** send Gmail or email unless explicitly asked.
3. Do **not** change unrelated sites.
4. Do **not** explore Yoast, neo-pulse WP tools, or SEO audit tools for a simple meta description change.

### Rank Math meta description

Client WordPress sites in this program use **Rank Math**. Updating meta description:

| Step | Tool | Arguments |
|------|------|-----------|
| Find post | `emcp-tools-search-content` | `{ "query": "<title or slug words>" }` |
| Resolve ID | `emcp-tools-list-posts` if needed | `{ "post_type": "post", "search": "<slug>", "per_page": 5 }` |
| Write | `emcp-tools-rankmath-write` | `{ "operation": "update-post-seo", "arguments": { "post_id": <int>, "description": "<text>" } }` |
| Verify | `emcp-tools-rankmath-read` | `{ "operation": "get-post-seo", "arguments": { "post_id": <int> } }` |

`post_id` must be a **number**. Slugs from URLs are not valid `post_id` values.

**Wrong (do not generate siteTasks like this):**

```json
{
  "tool": "emcp-tools-update-post",
  "arguments": {
    "post_id": "my-blog-slug",
    "meta_description": "..."
  }
}
```

**Right:**

```json
{
  "tool": "emcp-tools-rankmath-write",
  "arguments": {
    "operation": "update-post-seo",
    "arguments": {
      "post_id": 21030,
      "description": "..."
    }
  }
}
```

### Customer reply (after site work only)

- Do **not** draft or show a Gmail reply during triage or on the first Slack card.
- After the Cursor cloud agent verifies the change, `email-desk-completion.replyDraft` becomes the Gmail draft body.
- Quote the verified meta description; do not mention title, URL, or slug unless the customer asked.

## Allowlisted EMCP tool names (desk)

```
emcp-tools-search-content
emcp-tools-get-post
emcp-tools-list-posts
emcp-tools-update-post
emcp-tools-get-page-structure
emcp-tools-update-element
emcp-tools-rankmath-read
emcp-tools-rankmath-write
```

Hub server-side invoke (`POST /api/internal/emcp/invoke`) mirrors the same allowlist and rewrites legacy `update-post` + `meta_description` tasks to `rankmath-write` when configured.

## Live contract URL (hub must fetch this)

Neo Agent Hub / Flowbie email desk should load instructions and allowlist from:

`https://neodigital.ca/wp-content/uploads/neo-pulse-data/email-desk-cloud-agent-contract.json`

(Published via `node wordpress-plugins/.deploy/publish-email-desk-cloud-agent-contract.mjs`.)

When building a **Cursor cloud agent** user message, prepend `cloudAgentInstructions` only (not `openRouterTriage.instructions`).

For **OpenRouter inbox triage** (Slack `/email-desk test`, Send to Cursor), use `openRouterTriage.instructions` and enforce `requiredFields` (`actionable`, `summary`). **Reject or strip `replyDraft`** per `forbiddenFields` / `slackUi.triageForbiddenFields`. Do not inject `cloudAgentInstructions` into triage.

Honor **`slackUi`**: first Slack card has no proposed reply, no `/email-desk edit-reply`, no "Work confirmed, send reply" until post-completion creates a Gmail draft link card.

Set `Allowlisted EMCP tool names` from `allowlistedEmcpTools`. For meta description jobs, POST to `/api/internal/email-desk/meta-description-site-tasks` with `{ searchQuery, postId, description }` when `postId` is known, or build tasks using the template in the JSON.

## Post-completion (Gmail draft + Slack card)

After the **Cursor cloud agent** run finishes successfully:

1. Parse the agent's final message for a fenced JSON block labeled `email-desk-completion` (see `postCompletion` in the contract JSON). Fields: `status`, `workSummary`, `replyDraft`.
2. Create a **Gmail reply draft** on `sean@neodigital.ca` (Neo Agent Hub MCP `gmail-sean-neodigital`) using `replyDraft` as the body and the inbound thread id from the desk item.
3. Post a **new Slack message** in the same channel/thread with buttons linking to the draft and the original Gmail thread.

Hub helpers (when neo-pulse-app is deployed on neodigital):

| Step | Route |
|------|--------|
| Parse agent output | `POST /api/internal/email-desk/post-completion/parse-agent-message` `{ "text": "<final agent message>" }` |
| Build Slack card | `POST /api/internal/email-desk/post-completion/slack-reply-draft-card` `{ clientName, emailSubject, workSummary, gmailDraftUrl, gmailThreadUrl?, cursorRunUrl? }` |
| Draft deep link | `POST /api/internal/email-desk/post-completion/gmail-draft-url` `{ "draftId": "<from Gmail API>" }` |

TypeScript mirrors live in `src/lib/email-desk/email-desk-post-completion.ts` for the hosted Neo Agent Hub bot.

Republish contract after changes: `node wordpress-plugins/.deploy/publish-email-desk-cloud-agent-contract.mjs`.
