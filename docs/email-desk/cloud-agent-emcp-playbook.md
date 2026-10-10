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

### Proposed customer reply

- State that the meta description was updated and quote the new description.
- Do not mention title, URL, or slug unless the customer asked.

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
