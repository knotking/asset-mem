import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CollectionReference, Firestore } from 'firebase/firestore';
import { deleteAllInCollection } from '@homeapp/common/lib/deletion';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated Prefer deleteAllInCollection from @homeapp/common/lib/deletion */
export async function deleteCollection(db: Firestore, collectionRef: CollectionReference) {
  await deleteAllInCollection(db, collectionRef);
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
