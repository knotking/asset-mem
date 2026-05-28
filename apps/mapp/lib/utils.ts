import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { query, getDocs, writeBatch, type CollectionReference, type Firestore } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Deletes all documents in a Firestore collection using batched writes
 * @param db Firestore instance
 * @param collectionRef The collection reference to delete documents from
 */
export async function deleteCollection(db: Firestore, collectionRef: CollectionReference) {
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
