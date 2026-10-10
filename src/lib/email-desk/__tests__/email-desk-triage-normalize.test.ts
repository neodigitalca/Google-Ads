import { describe, expect, it } from "vitest";
import { EMAIL_DESK_DEFERRED_REPLY_DRAFT } from "@/lib/email-desk/email-desk-triage-constants";
import { normalizeOpenRouterTriageResponse } from "@/lib/email-desk/email-desk-triage-normalize";

describe("email-desk-triage-normalize", () => {
  it("injects deferred replyDraft when missing", () => {
    const out = normalizeOpenRouterTriageResponse({
      actionable: true,
      summary: "Meta description change on blog",
      siteTasks: [],
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.triage.replyDraft).toBe(EMAIL_DESK_DEFERRED_REPLY_DRAFT);
    }
  });

  it("fails when summary missing", () => {
    const out = normalizeOpenRouterTriageResponse({
      actionable: true,
      replyDraft: "",
    });
    expect(out.ok).toBe(false);
  });
});
