/**
 * Neo Agent Hub: after Cursor cloud agent finishes site work, create Gmail reply draft + Slack card.
 */

export const EMAIL_DESK_COMPLETION_FENCE = "email-desk-completion";

export type EmailDeskAgentCompletion = {
  status: "ok" | "failed";
  workSummary: string;
  replyDraft: string;
};

export const EMAIL_DESK_AGENT_COMPLETION_JSON_SCHEMA = {
  type: "object",
  required: ["status", "workSummary", "replyDraft"],
  properties: {
    status: { type: "string", enum: ["ok", "failed"] },
    workSummary: { type: "string" },
    replyDraft: {
      type: "string",
      description: "Plain-text Gmail reply body (empty when status is failed).",
    },
  },
  additionalProperties: false,
} as const;

export const EMAIL_DESK_CLOUD_AGENT_COMPLETION_INSTRUCTIONS = `After all siteTasks are done (verified or failed), end your final assistant message with exactly one fenced JSON block labeled ${EMAIL_DESK_COMPLETION_FENCE}. No text after that fence.

The JSON must match: status ("ok" or "failed"), workSummary (one short line of what you did), replyDraft (plain-text customer reply when status is ok; empty string when failed).

replyDraft rules: only what the customer asked; quote verified meta description or other changed fields; do not mention title, URL, or slug unless they asked; sign off as Neo Digital. Do not send Gmail yourself.`;

export type EmailDeskPostCompletionHubContext = {
  clientName?: string;
  emailSubject?: string;
  inboundFrom?: string;
  gmailThreadUrl?: string;
  cursorRunUrl?: string;
  workSummary: string;
  gmailDraftUrl: string;
};

/** Gmail web UI deep link to open a draft by API draft id. */
export function gmailDraftWebUrl(draftId: string, userIndex = 0): string {
  const id = draftId.trim();
  if (!id) {
    throw new Error("draftId is required");
  }
  return `https://mail.google.com/mail/u/${userIndex}/#drafts?compose=${encodeURIComponent(id)}`;
}

/**
 * Parse the cloud agent completion block from a Cursor run transcript or final message.
 */
export function parseEmailDeskCompletionFromText(text: string): EmailDeskAgentCompletion | null {
  const raw = text.trim();
  if (!raw) {
    return null;
  }

  const labeledFence = new RegExp(
    `\`\`\`${EMAIL_DESK_COMPLETION_FENCE}\\s*\\n([\\s\\S]*?)\\n\`\`\``,
    "i",
  );
  const labeled = raw.match(labeledFence);
  const jsonSlice = labeled?.[1]?.trim() ?? tryGenericCompletionFence(raw);
  if (!jsonSlice) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const status = record.status;
  if (status !== "ok" && status !== "failed") {
    return null;
  }
  const workSummary = typeof record.workSummary === "string" ? record.workSummary.trim() : "";
  const replyDraft = typeof record.replyDraft === "string" ? record.replyDraft.trim() : "";

  if (status === "ok" && !replyDraft) {
    return null;
  }

  return { status, workSummary, replyDraft };
}

function tryGenericCompletionFence(text: string): string | null {
  const fences = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/gi)];
  for (let i = fences.length - 1; i >= 0; i -= 1) {
    const slice = fences[i]?.[1]?.trim();
    if (!slice) {
      continue;
    }
    try {
      const obj = JSON.parse(slice) as Record<string, unknown>;
      if (obj.status === "ok" || obj.status === "failed") {
        if ("workSummary" in obj && "replyDraft" in obj) {
          return slice;
        }
      }
    } catch {
      /* try previous fence */
    }
  }
  return null;
}

/** Slack Block Kit payload for "reply draft ready" (Neo Agent Hub posts after Gmail draft is created). */
export function buildSlackReplyDraftReadyBlocks(
  ctx: EmailDeskPostCompletionHubContext,
): { blocks: Record<string, unknown>[]; text: string } {
  const client = ctx.clientName?.trim() || "Client";
  const subject = ctx.emailSubject?.trim() || "Re: your request";
  const summary = ctx.workSummary.trim() || "Site work finished.";
  const draftUrl = ctx.gmailDraftUrl.trim();
  const threadUrl = ctx.gmailThreadUrl?.trim();

  const lines = [
    `*Reply draft ready · ${subject}*`,
    summary,
    `<${draftUrl}|Open reply draft in Gmail> (body is in Gmail, not in Slack)`,
    threadUrl ? `<${threadUrl}|Open thread in Gmail>` : null,
    ctx.cursorRunUrl ? `<${ctx.cursorRunUrl}|Cursor cloud agent run>` : null,
  ].filter(Boolean);

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Email desk · ${client}`, emoji: false },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n") },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open reply draft", emoji: false },
          url: draftUrl,
          action_id: "email_desk_open_reply_draft",
        },
        ...(threadUrl
          ? [
              {
                type: "button",
                text: { type: "plain_text", text: "Open thread", emoji: false },
                url: threadUrl,
                action_id: "email_desk_open_gmail_thread",
              },
            ]
          : []),
      ],
    },
  ];

  return {
    text: `Email desk: reply draft ready for ${client}`,
    blocks,
  };
}

export function emailDeskPostCompletionContractSection() {
  return {
    version: 1,
    agentCompletionFence: EMAIL_DESK_COMPLETION_FENCE,
    agentCompletionJsonSchema: EMAIL_DESK_AGENT_COMPLETION_JSON_SCHEMA,
    hubSteps: [
      {
        id: "parseCursorAgentFinalMessage",
        parse: EMAIL_DESK_COMPLETION_FENCE,
      },
      {
        id: "gmailCreateReplyDraft",
        account: "sean@neodigital.ca",
        mcpServer: "gmail-sean-neodigital",
        bodyField: "replyDraft",
        threadIdField: "gmailThreadId",
      },
      {
        id: "slackPostReplyDraftCard",
        template: "replyDraftReady",
        channelField: "slackChannelId",
        threadTsField: "slackThreadTs",
        blocksFrom: "buildSlackReplyDraftReadyBlocks",
      },
    ],
    gmailDraftWebUrlPattern: "https://mail.google.com/mail/u/0/#drafts?compose={draftId}",
  };
}
