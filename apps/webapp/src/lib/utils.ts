import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CollectionReference } from "firebase/firestore";
import { deleteAllInCollection } from "@homeapp/common/lib/deletion";
import { db } from "./firebase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Deletes a collection and all its documents (paginated batches).
 * Note: This does not handle sub-collections within the documents.
 */
export async function deleteCollection(collectionRef: CollectionReference) {
  await deleteAllInCollection(db, collectionRef);
}

/**
 * Converts a string of markdown to a format compatible with WhatsApp.
 * @param markdown The markdown string to convert.
 * @returns A WhatsApp-formatted string.
 */
export function markdownToWhatsapp(markdown: string): string {
  if (!markdown) return "";

  let whatsappText = markdown;

  // Convert bold: **text** -> *text*
  whatsappText = whatsappText.replace(/\*\*(.*?)\*\*/g, "*$1*");

  // Convert links: [text](url) -> text: url
  whatsappText = whatsappText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2");

  // Convert headings: # Heading -> *Heading*
  whatsappText = whatsappText.replace(/^#+\s+(.+)/gm, "*$1*");

  // Lists, italic, strikethrough, and code blocks are generally okay.
  // WhatsApp uses similar syntax. We just need to handle things it doesn't support.

  // Remove blockquotes
  whatsappText = whatsappText.replace(/^>\s+/gm, "");

  return whatsappText;
}

/**
 * Converts a string of simple HTML to a format compatible with WhatsApp.
 * @param html The HTML string to convert.
 * @returns A WhatsApp-formatted string.
 */
export function htmlToWhatsapp(html: string): string {
  if (!html) return "";

  let text = html;

  // Convert <br> to newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Convert bold: <b>, <strong> -> *text*
  text = text.replace(/<(b|strong)>(.*?)<\/\1>/gi, "*$2*");

  // Convert italic: <i>, <em> -> _text_
  text = text.replace(/<(i|em)>(.*?)<\/\1>/gi, "_$2_");

  // Convert strikethrough: <s>, <strike>, <del> -> ~text~
  text = text.replace(/<(s|strike|del)>(.*?)<\/\1>/gi, "~$2~");

  // Convert links: <a href="url">text</a> -> text: url
  text = text.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2: $1");

  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  return text;
}

/**
 * Gets the base API URL from environment variables
 * Falls back to NEXT_PUBLIC_API_BASE_URL or legacy individual URL variables for backward compatibility
 */
function trimProxyBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function getBaseApiUrl(): string {
  // Prefer the new unified API base URL
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return trimProxyBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  }

  // Backward compatibility: also check NEXT_PUBLIC_API_URL
  if (process.env.NEXT_PUBLIC_API_URL) {
    return trimProxyBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  }

  // Fallback: extract base URL from existing variables for backward compatibility
  const agentSessionUrl = process.env.NEXT_PUBLIC_AGENT_SESSION_URL;
  if (agentSessionUrl) {
    return agentSessionUrl.replace("/agent-session", "");
  }

  const agentSseUrl = process.env.NEXT_PUBLIC_AGENT_SSE_URL;
  if (agentSseUrl) {
    return agentSseUrl.replace("/firebase-agent-stream", "");
  }

  const ragFileUploadUrl = process.env.NEXT_RAG_FILE_UPLOAD_URL;
  if (ragFileUploadUrl) {
    return ragFileUploadUrl.replace("/rag-file-upload", "");
  }

  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL or a fallback API URL environment variable must be set"
  );
}

/**
 * Constructs API endpoint URLs from the base API URL
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getBaseApiUrl();
  // Ensure base URL doesn't end with / and endpoint starts with /
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${cleanBase}${cleanEndpoint}`;
}

/**
 * API endpoint URL getters
 */
export const apiUrls = {
  agentSession: () => getApiUrl("/agent-session"),
  agentSse: () => getApiUrl("/firebase-agent-stream"),
  ragFileUpload: () => getApiUrl("/rag-file-upload"),
  extractDocInfo: () => getApiUrl("/extract-doc-info"),
  analyzeCheckpoint: () => getApiUrl("/analyze-checkpoint"),
  compareCheckpoints: () => getApiUrl("/compare-checkpoints"),
  /** Same monthly limit resolution as proxy enforcement; optional fallback in UI if request fails */
  tokenQuotaStatus: () => getApiUrl("/token-quota-status"),
  /** B2C Stripe Checkout (Bearer Firebase ID token) */
  billingB2cCheckout: () => getApiUrl("/billing/b2c/checkout-session"),
  /** B2C Stripe Customer Portal */
  billingB2cPortal: () => getApiUrl("/billing/b2c/portal-session"),
  /** Exchange mobile one-time handoff code for Firebase custom token */
  mobileWebHandoffConsume: () => getApiUrl("/auth/mobile-web-handoff/consume"),
};
