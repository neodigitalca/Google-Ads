/** Non-empty sentinel: hub requires replyDraft with length; never show in Slack. */
export const EMAIL_DESK_DEFERRED_REPLY_DRAFT = "__EMAIL_DESK_DEFERRED__";

export const EMAIL_DESK_TRIAGE_REPLY_DRAFT_POLICY = {
  mode: "deferredPlaceholder",
  triagePlaceholder: EMAIL_DESK_DEFERRED_REPLY_DRAFT,
} as const;
