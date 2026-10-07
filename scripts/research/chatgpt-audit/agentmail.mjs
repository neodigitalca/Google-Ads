export function extractOtpFromText(text) {
  const normalized = String(text ?? "");
  const matches = normalized.match(/\b(\d{6,8})\b/g);
  if (!matches || matches.length === 0) return "";
  return matches[matches.length - 1];
}

export async function fetchAgentMailMessages(apiKey, inbox, afterIso, filters = {}) {
  const params = new URLSearchParams({ limit: "20" });
  if (afterIso) params.set("after", afterIso);
  if (filters.from) params.set("from", filters.from);
  if (filters.subject) params.set("subject", filters.subject);
  const url = `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages?${params}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(`AgentMail list failed (${res.status}): ${raw.slice(0, 200)}`);
  }
  const data = await res.json();
  return Array.isArray(data?.messages) ? data.messages : Array.isArray(data?.items) ? data.items : [];
}

export async function fetchAgentMailMessageBody(apiKey, inbox, messageId) {
  const url = `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/${encodeURIComponent(messageId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) return "";
  const data = await res.json();
  const parts = [
    data?.subject,
    data?.text,
    data?.body_text,
    data?.body?.text,
    data?.html,
    data?.body_html,
    data?.body?.html,
  ];
  return parts.filter(Boolean).join("\n");
}

function messageTimestampMs(message) {
  const raw = message?.timestamp ?? message?.created_at ?? message?.sent_at;
  const ms = Date.parse(String(raw ?? ""));
  return Number.isFinite(ms) ? ms : 0;
}

function isChatGptVerificationMessage(message) {
  const haystack = [
    message?.subject,
    message?.from,
    message?.sender,
    message?.preview,
    message?.snippet,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    haystack.includes("chatgpt")
    || haystack.includes("openai")
    || haystack.includes("verification")
  );
}

export async function pollAgentMailOtp(apiKey, inbox, loginStartedAt, progress, page) {
  const afterMs = loginStartedAt - 15_000;
  const afterIso = new Date(afterMs).toISOString();
  const deadline = Date.now() + 180_000;
  const seenIds = new Set();

  while (Date.now() < deadline) {
    progress?.step("Waiting for login code in AgentMail");
    const messages = await fetchAgentMailMessages(apiKey, inbox, afterIso);
    const sorted = [...messages].sort(
      (left, right) => messageTimestampMs(right) - messageTimestampMs(left),
    );
    for (const message of sorted) {
      const messageId = String(message?.message_id ?? message?.id ?? "").trim();
      if (!messageId || seenIds.has(messageId)) continue;
      seenIds.add(messageId);

      if (messageTimestampMs(message) > 0 && messageTimestampMs(message) < afterMs) continue;
      if (!isChatGptVerificationMessage(message)) continue;

      let body = [
        message?.subject,
        message?.text,
        message?.body_text,
        message?.preview,
        message?.snippet,
      ]
        .filter(Boolean)
        .join("\n");

      if (!extractOtpFromText(body)) {
        body = await fetchAgentMailMessageBody(apiKey, inbox, messageId);
      }

      const otp = extractOtpFromText(body);
      if (otp) return otp;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error("Timed out waiting for ChatGPT login code in AgentMail inbox.");
}
