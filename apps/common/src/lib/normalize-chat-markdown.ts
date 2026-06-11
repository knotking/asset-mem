/**
 * Tighten vertical spacing in agent markdown before chat rendering.
 * LLM replies (e.g. "Show full analysis" replay) often include 3+ blank lines
 * between sections, which render as empty paragraphs and large gaps.
 */
export function normalizeChatMarkdownSpacing(text: string): string {
  if (!text || !text.trim()) return text ?? "";

  let normalized = text.replace(/\r\n/g, "\n");

  // Lines that are only whitespace still count as blank lines in markdown parsers.
  normalized = normalized.replace(/\n[ \t]+\n/g, "\n\n");

  // Collapse runs of 3+ newlines to a single paragraph break.
  normalized = normalized.replace(/\n{3,}/g, "\n\n");

  // Keep at most one blank line on each side of thematic breaks.
  normalized = normalized.replace(/\n{2,}((?:---|\*\*\*|___))\s*\n{2,}/g, "\n\n$1\n\n");

  return normalized.trim();
}
