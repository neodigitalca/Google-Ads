import {
  EMAIL_DESK_DEFERRED_REPLY_DRAFT,
  EMAIL_DESK_TRIAGE_REPLY_DRAFT_POLICY,
} from "@/lib/email-desk/email-desk-triage-constants";

export { EMAIL_DESK_DEFERRED_REPLY_DRAFT } from "@/lib/email-desk/email-desk-triage-constants";

export type NormalizedEmailDeskTriage = Record<string, unknown> & {
  actionable: boolean;
  summary: string;
  replyDraft: string;
};

/**
 * Neo Agent Hub should call this on every OpenRouter triage JSON before validation.
 * Fills missing/empty replyDraft with the deferred sentinel so checks pass.
 */
export function normalizeOpenRouterTriageResponse(
  raw: unknown,
): { ok: true; triage: NormalizedEmailDeskTriage } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Triage response must be a JSON object." };
  }

  const triage = { ...(raw as Record<string, unknown>) };

  if (typeof triage.actionable !== "boolean") {
    return { ok: false, error: "OpenRouter triage missing actionable (boolean)." };
  }
  if (typeof triage.summary !== "string" || triage.summary.trim() === "") {
    return { ok: false, error: "OpenRouter triage missing summary." };
  }

  const policy = EMAIL_DESK_TRIAGE_REPLY_DRAFT_POLICY;
  let replyDraft = typeof triage.replyDraft === "string" ? triage.replyDraft : "";

  if (replyDraft.trim() === "" || replyDraft === EMAIL_DESK_DEFERRED_REPLY_DRAFT) {
    if (policy.mode === "deferredPlaceholder") {
      replyDraft = policy.triagePlaceholder;
    } else {
      replyDraft = "";
    }
  }

  if (policy.mode === "deferredPlaceholder" && replyDraft.trim() === "") {
    replyDraft = policy.triagePlaceholder;
  }

  triage.replyDraft = replyDraft;

  if (typeof triage.replyDraft !== "string") {
    return { ok: false, error: "OpenRouter triage missing replyDraft." };
  }

  return {
    ok: true,
    triage: triage as NormalizedEmailDeskTriage,
  };
}
