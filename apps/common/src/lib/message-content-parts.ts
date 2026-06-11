import { normalizeChatMarkdownSpacing } from "./normalize-chat-markdown";
import type { Message, StructuredResponseData } from "../types";

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
  const rawMarkdown =
    typeof message.contentMarkdown === "string" && message.contentMarkdown.trim()
      ? message.contentMarkdown
      : typeof message.content === "string"
        ? message.content
        : "";
  const markdown = rawMarkdown ? normalizeChatMarkdownSpacing(rawMarkdown) : "";

  const rawJson = message.contentJson;
  const contentJson =
    rawJson && typeof rawJson === "object"
      ? (rawJson as StructuredResponseData)
      : null;

  return { markdown, contentJson };
}
