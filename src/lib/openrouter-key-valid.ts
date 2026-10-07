/** Matches revoked placeholder filtered in `Neo_Pulse_App_Secrets::openrouter_key_is_invalid`. */
export const KNOWN_INVALID_OPENROUTER_KEY_SUBSTR =
  "0df04520eb8c0146e19f925295a5559b058f399917db3db7c0a3e3bb97361148";

export function isKnownInvalidOpenRouterKey(key: string | null | undefined): boolean {
  const trimmed = (key ?? "").trim();
  if (!trimmed) return true;
  return trimmed.includes(KNOWN_INVALID_OPENROUTER_KEY_SUBSTR);
}
