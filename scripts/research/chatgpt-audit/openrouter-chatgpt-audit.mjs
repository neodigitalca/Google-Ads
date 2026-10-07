const CHATGPT_AUDIT_RESPONSE_RULES =
  "Keep the reply relatively short and scannable. Do not use horizontal line separators (--- or hr). " +
  "Put your full answer in one markdown code block only (```markdown ... ```).";

export function pickOpenRouterKey(env) {
  return String(
    env.OPENROUTER_API_KEY ??
      env.NEO_PULSE_APP_OPENROUTER_API_KEY ??
      env.OPEN_ROUTER_API_KEY ??
      "",
  ).trim();
}

function pickOpenRouterModel(env) {
  return String(
    env.CHATGPT_AUDIT_OPENROUTER_MODEL ??
      env.OPENROUTER_MODEL ??
      env.NEO_PULSE_APP_OPENROUTER_MODEL ??
      "google/gemini-2.5-flash",
  ).trim();
}

/** @typedef {{ fullName: string, age: number }} OnboardingProfile */

export async function generateOnboardingProfile(env) {
  const apiKey = pickOpenRouterKey(env);
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for ChatGPT onboarding profile generation.");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca",
      "X-Title": "Flowbie ChatGPT Audit",
    },
    body: JSON.stringify({
      model: pickOpenRouterModel(env),
      temperature: 0.9,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Generate one plausible fictional person for a generic web signup form. " +
            "Return JSON only: { \"fullName\": string, \"age\": number }. " +
            "fullName must be two common words (first and last). age must be an integer from 25 to 55.",
        },
        { role: "user", content: "Generate one profile." },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter onboarding profile failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter onboarding profile returned invalid JSON.");
  }

  const fullName = String(parsed?.fullName ?? "").trim();
  const age = Number(parsed?.age);
  if (!fullName || !Number.isInteger(age) || age < 18 || age > 80) {
    throw new Error("OpenRouter onboarding profile returned an invalid fullName or age.");
  }

  return { fullName, age };
}

/** @param {string} pageUrl */
function inferChatGptAuditPageKind(pageUrl) {
  try {
    const path = new URL(pageUrl).pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || /^\/(index\.html?|home)$/i.test(path)) return "homepage";
    if (
      /\/(blog|news|articles?|post|posts)\/[^/]+/i.test(path) ||
      /\/\d{4}\/\d{2}\/[^/]+/.test(path)
    ) {
      return "article";
    }
    return "page";
  } catch {
    return "page";
  }
}

/**
 * @param {{ clientName?: string, pageUrl: string, question: string }} input
 * @param {Record<string, string>} env
 */
export async function composeChatGptAuditPrompt(input, env) {
  const pageUrl = String(input?.pageUrl ?? "").trim();
  const question = String(input?.question ?? "").trim();
  const clientName = String(input?.clientName ?? "").trim();
  if (!pageUrl) throw new Error("Missing page URL for ChatGPT audit prompt.");
  if (!question) throw new Error("Missing audit question for ChatGPT audit prompt.");

  const apiKey = pickOpenRouterKey(env);
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for ChatGPT audit prompt composition.");
  }

  const pageKind = inferChatGptAuditPageKind(pageUrl);
  const userLines = [
    `Page URL: ${pageUrl}`,
    `Page kind hint: ${pageKind}`,
    `Audit question: ${question}`,
  ];
  if (clientName) userLines.unshift(`Client name: ${clientName}`);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://neodigital.ca",
      "X-Title": "Flowbie ChatGPT Audit",
    },
    body: JSON.stringify({
      model: pickOpenRouterModel(env),
      temperature: 0.35,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Write one ChatGPT user message for an AISEO audit. Return JSON only: { \"prompt\": string }. " +
            "Sound like a real person asking a colleague — direct, natural, not a template. " +
            "Include the full page URL once. Refer to what is on this specific URL or this specific web page " +
            "(never say website alone). " +
            "Use the page kind hint: for homepage use homepage/main page/language like that; " +
            "never call a homepage an article or blog post. For article, article/post is fine. " +
            "For page, say page or contents at this URL — do not assume it is an article. " +
            "Weave the audit question in naturally; do not add labels like Website: or Question:. " +
            "Do not use stiff phrases like article found at unless the URL is clearly an article and it fits. " +
            "Prefer the contents of this URL or what is on this page when unsure. " +
            "Preserve the intent of the audit question without copying it word-for-word if it sounds robotic. " +
            `End the prompt by telling ChatGPT: ${CHATGPT_AUDIT_RESPONSE_RULES}`,
        },
        { role: "user", content: userLines.join("\n") },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OpenRouter audit prompt failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter audit prompt returned invalid JSON.");
  }

  const prompt = String(parsed?.prompt ?? "").trim();
  if (!prompt) throw new Error("OpenRouter audit prompt returned an empty prompt.");
  if (!prompt.includes(pageUrl)) {
    throw new Error("OpenRouter audit prompt did not include the page URL.");
  }
  if (/^\s*(website|question)\s*:/im.test(prompt)) {
    throw new Error("OpenRouter audit prompt used forbidden Website:/Question: labels.");
  }
  if (pageKind === "homepage" && /\barticle\b/i.test(prompt)) {
    throw new Error("OpenRouter audit prompt incorrectly called a homepage an article.");
  }
  if (!prompt.includes("```markdown")) {
    return `${prompt} ${CHATGPT_AUDIT_RESPONSE_RULES}`;
  }
  return prompt;
}
