import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { collection, query, getDocs, writeBatch, type CollectionReference } from "firebase/firestore";
import { db } from "./firebase";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Deletes a collection and all its documents.
 * Note: This does not handle sub-collections within the documents.
 */
export async function deleteCollection(collectionRef: CollectionReference) {
  const q = query(collectionRef);
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.size === 0) {
    return; // No documents to delete
  }

  const batch = writeBatch(db);
  querySnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

/**
 * Converts a string of markdown to a format compatible with WhatsApp.
 * @param markdown The markdown string to convert.
 * @returns A WhatsApp-formatted string.
 */
export function markdownToWhatsapp(markdown: string): string {
  if (!markdown) return '';

  let whatsappText = markdown;

  // Convert bold: **text** -> *text*
  whatsappText = whatsappText.replace(/\*\*(.*?)\*\*/g, '*$1*');
  
  // Convert links: [text](url) -> text: url
  whatsappText = whatsappText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');

  // Convert headings: # Heading -> *Heading*
  whatsappText = whatsappText.replace(/^#+\s+(.+)/gm, '*$1*');
  
  // Lists, italic, strikethrough, and code blocks are generally okay.
  // WhatsApp uses similar syntax. We just need to handle things it doesn't support.

  // Remove blockquotes
  whatsappText = whatsappText.replace(/^>\s+/gm, '');

  return whatsappText;
}

/**
 * Converts a string of simple HTML to a format compatible with WhatsApp.
 * @param html The HTML string to convert.
 * @returns A WhatsApp-formatted string.
 */
export function htmlToWhatsapp(html: string): string {
  if (!html) return '';

  let text = html;

  // Convert <br> to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Convert bold: <b>, <strong> -> *text*
  text = text.replace(/<(b|strong)>(.*?)<\/\1>/gi, '*$2*');

  // Convert italic: <i>, <em> -> _text_
  text = text.replace(/<(i|em)>(.*?)<\/\1>/gi, '_$2_');

  // Convert strikethrough: <s>, <strike>, <del> -> ~text~
  text = text.replace(/<(s|strike|del)>(.*?)<\/\1>/gi, '~$2~');
  
  // Convert links: <a href="url">text</a> -> text: url
  text = text.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2: $1');
  
  // Strip any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  return text;
}
