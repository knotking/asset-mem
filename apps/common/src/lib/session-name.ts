/** Minimum trimmed length to use first-message text as the session title. */
export const SESSION_NAME_MIN_MESSAGE_CHARS = 4;

/** Max characters stored for an auto-generated session title. */
export const SESSION_NAME_MAX_LENGTH = 60;

export function messageTextForSessionName(message: {
  content?: string;
  contentMarkdown?: string;
}): string {
  return (message.contentMarkdown ?? message.content ?? "").trim();
}

/** Short date fallback when the first user message is too short to name the session. */
export function formatSessionFallbackName(date = new Date()): string {
  return `Chat · ${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

/** Derive a session list title from the first user message, with date fallback. */
export function deriveSessionNameFromFirstMessage(
  text: string,
  options?: {
    minLength?: number;
    maxLength?: number;
    fallbackDate?: Date;
  }
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const minLength = options?.minLength ?? SESSION_NAME_MIN_MESSAGE_CHARS;
  const maxLength = options?.maxLength ?? SESSION_NAME_MAX_LENGTH;

  if (normalized.length >= minLength) {
    if (normalized.length <= maxLength) {
      return normalized;
    }
    return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
  }

  return formatSessionFallbackName(options?.fallbackDate);
}
