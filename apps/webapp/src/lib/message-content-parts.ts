/**
 * Chat content resolver — local copy for App Hosting (webapp does not depend on @homeapp/common).
 * Keep in sync with apps/common/src/lib/message-content-parts.ts.
 * Display gating (structured vs markdown) lives in message-display-parts.ts (sync with mapp chat-content-parse.ts).
 */
import type { Message, StructuredResponseData } from "@/lib/types";

export type ResolvedMessageContentParts = {
  markdown: string;
  contentJson: StructuredResponseData | null;
};

/**
 * Canonical chat content resolver for structured message schema (contentJson + contentMarkdown).
 */
export function resolveMessageContentParts(
  message: Message
): ResolvedMessageContentParts {
  const markdown =
    typeof message.contentMarkdown === "string" && message.contentMarkdown.trim()
      ? message.contentMarkdown
      : typeof message.content === "string"
        ? message.content
        : "";

  const rawJson = message.contentJson;
  const contentJson =
    rawJson && typeof rawJson === "object"
      ? (rawJson as StructuredResponseData)
      : null;

  return { markdown, contentJson };
}
