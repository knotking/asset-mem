/**
 * Dual-format clipboard for web chat copy (plain WhatsApp + HTML/markdown for rich paste).
 */
import type { Message } from "@/lib/types";
import {
  buildAssistantMessageCopyText,
  type MessageCopyFormat,
} from "@/lib/message-copy-text";
import { resolveMessageContentParts } from "@/lib/message-content-parts";
import { markdownToWhatsapp } from "@/lib/utils";

export type WebMessageCopyPayload = {
  /** WhatsApp-friendly plain text (text/plain). */
  plain: string;
  /** Markdown with [label](url) links for docs/Notion-style paste (text/html source). */
  markdown: string;
  html: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(text: string): string {
  return escapeHtml(text).replace(/'/g, "&#39;");
}

function formatBoldItalic(html: string): string {
  return html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

/** Inline markdown → HTML for clipboard rich paste. */
export function inlineMarkdownToHtml(text: string): string {
  const linkRe = /\[([^\]]+)\]\((https?:\/\/.*?)\)/g;
  let html = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) html += formatBoldItalic(escapeHtml(before));
    const url = match[2].trim().replace(/ /g, "%20");
    html += `<a href="${escapeHtmlAttr(url)}">${escapeHtml(match[1])}</a>`;
    lastIndex = match.index + match[0].length;
  }

  const tail = text.slice(lastIndex);
  if (tail) html += formatBoldItalic(escapeHtml(tail));
  return html;
}

/** Wrap fragment for Gmail/Word rich-paste compatibility. */
export function wrapClipboardHtml(fragment: string): string {
  if (!fragment.trim()) return "";
  return [
    "<html>",
    "<body>",
    "<!--StartFragment-->",
    fragment,
    "<!--EndFragment-->",
    "</body>",
    "</html>",
  ].join("");
}

/** Convert exported copy markdown to HTML for ClipboardItem text/html. */
export function markdownCopyTextToHtml(markdown: string): string {
  if (!markdown.trim()) return "";

  const blocks: string[] = [];
  const lines = markdown.split("\n");
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    for (const line of paragraphLines) {
      blocks.push(`<div>${inlineMarkdownToHtml(line)}</div>`);
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      `<ul>${listItems.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join("")}</ul>`
    );
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushParagraph();
      blocks.push("<div><br></div>");
      continue;
    }

    const h1 = trimmed.match(/^# (.+)$/);
    const h2 = trimmed.match(/^## (.+)$/);
    const h3 = trimmed.match(/^### (.+)$/);
    if (h1 || h2 || h3) {
      flushList();
      flushParagraph();
      const level = h1 ? 1 : h2 ? 2 : 3;
      const title = (h1 || h2 || h3)![1];
      blocks.push(`<h${level}>${inlineMarkdownToHtml(title)}</h${level}>`);
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[-*•]\s+/, ""));
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushList();
  flushParagraph();
  return wrapClipboardHtml(blocks.join(""));
}

function resolveCopySource(message: Message, format: MessageCopyFormat): string {
  if (message.role === "user") {
    return resolveMessageContentParts(message).markdown;
  }
  return buildAssistantMessageCopyText(message, format);
}

export function buildWebMessageCopyPayload(message: Message): WebMessageCopyPayload {
  const markdown = resolveCopySource(message, "markdown");
  const plainSource = resolveCopySource(message, "plain");
  const plain = markdownToWhatsapp(plainSource);
  return {
    plain,
    markdown,
    html: markdownCopyTextToHtml(markdown),
  };
}

export async function copyChatMessageToClipboard(message: Message): Promise<boolean> {
  const { plain, html } = buildWebMessageCopyPayload(message);

  if (typeof navigator !== "undefined" && navigator.clipboard?.write && "ClipboardItem" in window) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plain], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    } catch {
      // Fall through to plain text.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plain);
    return true;
  }

  const textArea = document.createElement("textarea");
  textArea.value = plain;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand("copy");
    return true;
  } finally {
    document.body.removeChild(textArea);
  }
}
