const urlRegex = /(https?:\/\/[^\s]+)/gi;
const trailingPunctuationRegex = /[.,!?:;)\]]+$/;

function normalizeCandidateUrl(candidate: string): string {
  return candidate.replace(trailingPunctuationRegex, "");
}

function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function extractFirstHttpUrl(text: string): string | null {
  if (!text) return null;

  const matches = text.match(urlRegex);
  if (!matches || matches.length === 0) return null;

  for (const raw of matches) {
    const normalized = normalizeCandidateUrl(raw.trim());
    if (normalized && isValidHttpUrl(normalized)) {
      return normalized;
    }
  }

  return null;
}
