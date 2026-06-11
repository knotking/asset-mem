/**
 * Tighten vertical spacing in agent markdown before chat rendering.
 * Keep in sync with apps/common/src/lib/normalize-chat-markdown.ts.
 */
export function normalizeChatMarkdownSpacing(text: string): string {
  if (!text || !text.trim()) return text ?? "";

  let normalized = text.replace(/\r\n/g, "\n");

  normalized = normalized.replace(/\n[ \t]+\n/g, "\n\n");
  normalized = normalized.replace(/\n{3,}/g, "\n\n");
  normalized = normalized.replace(/\n{2,}((?:---|\*\*\*|___))\s*\n{2,}/g, "\n\n$1\n\n");

  return normalized.trim();
}
