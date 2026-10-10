import { describe, expect, it } from "vitest";
import {
  buildSlackReplyDraftReadyBlocks,
  gmailDraftWebUrl,
  parseEmailDeskCompletionFromText,
} from "@/lib/email-desk/email-desk-post-completion";

describe("email-desk-post-completion", () => {
  it("parses labeled completion fence", () => {
    const text = `
Done.

\`\`\`email-desk-completion
{"status":"ok","workSummary":"Updated meta description.","replyDraft":"Hi,\\n\\nThe meta description is updated.\\n\\nNeo Digital"}
\`\`\`
`;
    const parsed = parseEmailDeskCompletionFromText(text);
    expect(parsed?.status).toBe("ok");
    expect(parsed?.replyDraft).toContain("Neo Digital");
  });

  it("builds gmail draft url", () => {
    expect(gmailDraftWebUrl("r123")).toBe(
      "https://mail.google.com/mail/u/0/#drafts?compose=r123",
    );
  });

  it("builds slack reply draft card", () => {
    const { blocks, text } = buildSlackReplyDraftReadyBlocks({
      clientName: "Blind Magic",
      emailSubject: "Meta description",
      workSummary: "Rank Math description verified.",
      gmailDraftUrl: gmailDraftWebUrl("draft-abc"),
      gmailThreadUrl: "https://mail.google.com/mail/u/0/#inbox/thread123",
    });
    expect(text).toMatch(/Blind Magic/i);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const actions = blocks[2] as { elements?: { url?: string }[] };
    expect(actions.elements?.[0]?.url).toContain("draft-abc");
  });
});
