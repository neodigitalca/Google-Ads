/**
 * Single source of truth for Email desk Cursor cloud agent EMCP instructions and siteTasks.
 */

import {
  EMAIL_DESK_CLOUD_AGENT_COMPLETION_INSTRUCTIONS,
  emailDeskPostCompletionContractSection,
} from "@/lib/email-desk/email-desk-post-completion";

export const EMAIL_DESK_EMCP_ALLOWLIST = [
  "emcp-tools-search-content",
  "emcp-tools-get-post",
  "emcp-tools-list-posts",
  "emcp-tools-update-post",
  "emcp-tools-get-page-structure",
  "emcp-tools-update-element",
  "emcp-tools-rankmath-read",
  "emcp-tools-rankmath-write",
] as const;

/** Cursor cloud agent only (EMCP site work). Not for OpenRouter inbox triage. */
export const EMAIL_DESK_CLOUD_AGENT_INSTRUCTIONS = `You work on one client site per task via that site's EMCP MCP server.

Execute every entry in siteTasks JSON in order. Do not send Gmail or email. Do not change unrelated sites.

For Rank Math meta description updates (Neo Pulse client WordPress sites):
1. emcp-tools-search-content to find the post (title or slug words).
2. post_id must be a positive integer. If you only have a slug, use emcp-tools-list-posts with search set to the slug.
3. emcp-tools-rankmath-write with operation update-post-seo and arguments post_id plus description.
4. Verify with emcp-tools-rankmath-read get-post-seo or the public page meta description tag.

Do not use emcp-tools-update-post meta_description (ignored). Do not write rank_math_description via update-post meta (protected). Do not probe Yoast keys or run SEO audit tools for a simple meta change.

${EMAIL_DESK_CLOUD_AGENT_COMPLETION_INSTRUCTIONS}`;

/** Neo Agent Hub OpenRouter triage (inbox / Slack). Site work + Cursor only; no customer reply here. */
export const EMAIL_DESK_OPENROUTER_TRIAGE_INSTRUCTIONS = `Triage one inbound client email for Neo Digital Email desk.

Return JSON only. Do NOT include replyDraft, proposedReply, or any Gmail reply body. Customer replies are created only after the Cursor cloud agent finishes site work (email-desk-completion).

You MUST include: actionable (boolean), summary (short internal line), siteKey (when known), siteTasks (array when actionable).

For Rank Math meta description work on Neo Pulse WordPress sites, siteTasks must use emcp-tools-rankmath-write (update-post-seo), not emcp-tools-update-post with meta_description. post_id must be a positive integer, not a slug.`;

export const EMAIL_DESK_REPLY_INSTRUCTIONS =
  "Reply only about fields the customer mentioned. No title, URL, or unchanged disclaimers unless they asked.";

export const EMAIL_DESK_OPENROUTER_TRIAGE_JSON_SCHEMA = {
  type: "object",
  required: ["actionable", "summary"],
  properties: {
    siteKey: { type: "string" },
    siteTasks: { type: "array" },
    actionable: { type: "boolean" },
    summary: { type: "string" },
  },
  additionalProperties: true,
} as const;

/** Neo Agent Hub Slack cards: no reply text until post-completion Gmail draft exists. */
export const EMAIL_DESK_SLACK_UI = {
  version: 1,
  initialCard: {
    showProposedReply: false,
    showReplyBodyInSlack: false,
    showEditReplySlashCommand: false,
    showWorkConfirmedSendReplyButton: false,
    allowedSections: ["inboundMessage", "siteChecklist", "cursorCloudAgent"],
  },
  postCompletionCard: {
    showReplyBodyInSlack: false,
    gmailDraftLinkOnly: true,
    showWorkConfirmedSendReplyButton: false,
  },
  triageForbiddenFields: ["replyDraft", "proposedReply"],
} as const;

export type EmailDeskSiteTask = {
  tool: string;
  label: string;
  arguments: Record<string, unknown>;
};

export function buildMetaDescriptionSiteTasks(input: {
  searchQuery: string;
  postId: number;
  description: string;
}): EmailDeskSiteTask[] {
  const postId = Math.trunc(input.postId);
  if (postId <= 0) {
    throw new Error("postId must be a positive integer");
  }
  const description = input.description.trim();
  if (!description) {
    throw new Error("description is required");
  }
  const query = input.searchQuery.trim();
  return [
    {
      tool: "emcp-tools-search-content",
      label: "Find the blog post",
      arguments: { query: query || description.slice(0, 80) },
    },
    {
      tool: "emcp-tools-rankmath-write",
      label: "Update Rank Math meta description",
      arguments: {
        operation: "update-post-seo",
        arguments: {
          post_id: postId,
          description,
        },
      },
    },
    {
      tool: "emcp-tools-rankmath-read",
      label: "Verify Rank Math meta description",
      arguments: {
        operation: "get-post-seo",
        arguments: { post_id: postId },
      },
    },
  ];
}

export const META_DESCRIPTION_SITE_TASK_TEMPLATE: EmailDeskSiteTask[] = [
  {
    tool: "emcp-tools-search-content",
    label: "Find the blog post",
    arguments: { query: "<search query>" },
  },
  {
    tool: "emcp-tools-rankmath-write",
    label: "Update Rank Math meta description",
    arguments: {
      operation: "update-post-seo",
      arguments: {
        post_id: "<positive integer post ID>",
        description: "<meta description>",
      },
    },
  },
  {
    tool: "emcp-tools-rankmath-read",
    label: "Verify Rank Math meta description",
    arguments: {
      operation: "get-post-seo",
      arguments: { post_id: "<positive integer post ID>" },
    },
  },
];

export function emailDeskCloudAgentContractPayload() {
  return {
    version: 4,
    allowlistedEmcpTools: [...EMAIL_DESK_EMCP_ALLOWLIST],
    cloudAgentInstructions: EMAIL_DESK_CLOUD_AGENT_INSTRUCTIONS,
    openRouterTriage: {
      instructions: EMAIL_DESK_OPENROUTER_TRIAGE_INSTRUCTIONS,
      requiredFields: ["actionable", "summary"],
      forbiddenFields: [...EMAIL_DESK_SLACK_UI.triageForbiddenFields],
      responseJsonSchema: EMAIL_DESK_OPENROUTER_TRIAGE_JSON_SCHEMA,
    },
    slackUi: EMAIL_DESK_SLACK_UI,
    replyDraftInstructions: EMAIL_DESK_REPLY_INSTRUCTIONS,
    postCompletion: emailDeskPostCompletionContractSection(),
    metaDescriptionSiteTaskTemplate: META_DESCRIPTION_SITE_TASK_TEMPLATE,
  };
}
