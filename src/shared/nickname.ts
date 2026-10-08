export interface NicknameCheckResult {
  valid: boolean;
  reason?: "too_long" | "empty" | "blocked";
}

export function checkNickname(raw: string, blocklist: string[]): NicknameCheckResult {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { valid: false, reason: "empty" };
  if (trimmed.length > 20) return { valid: false, reason: "too_long" };
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const word of blocklist) {
    if (normalized.includes(word)) {
      return { valid: false, reason: "blocked" };
    }
  }
  return { valid: true };
}
