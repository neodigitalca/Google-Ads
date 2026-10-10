import { describe, expect, it } from "vitest";
import {
  buildMetaDescriptionSiteTasks,
  EMAIL_DESK_EMCP_ALLOWLIST,
  emailDeskCloudAgentContractPayload,
} from "@/lib/email-desk/email-desk-cloud-agent-contract";

describe("email-desk-cloud-agent-contract", () => {
  it("includes rankmath write and read in allowlist", () => {
    expect(EMAIL_DESK_EMCP_ALLOWLIST).toContain("emcp-tools-rankmath-write");
    expect(EMAIL_DESK_EMCP_ALLOWLIST).toContain("emcp-tools-rankmath-read");
  });

  it("builds rankmath siteTasks with integer post_id", () => {
    const tasks = buildMetaDescriptionSiteTasks({
      searchQuery: "Hunter Douglas shades",
      postId: 21030,
      description: "Edmonton test. Edmonton again.",
    });
    expect(tasks).toHaveLength(3);
    expect(tasks[1]?.tool).toBe("emcp-tools-rankmath-write");
    const inner = tasks[1]?.arguments as { arguments?: { post_id?: number } };
    expect(inner.arguments?.post_id).toBe(21030);
  });

  it("exports stable contract payload", () => {
    const payload = emailDeskCloudAgentContractPayload();
    expect(payload.version).toBe(3);
    expect(payload.cloudAgentInstructions).toMatch(/rankmath-write/i);
    expect(payload.cloudAgentInstructions).toMatch(/email-desk-completion/i);
    expect(payload.postCompletion?.hubSteps?.length).toBeGreaterThan(0);
    expect(payload.openRouterTriage.requiredFields).toContain("replyDraft");
    expect(payload.openRouterTriage.instructions).toMatch(/replyDraft/i);
    expect(payload.proposedReplyInstructions).toMatch(/title/i);
  });
});
