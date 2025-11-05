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

/**
 * Converts a JSON object into a WhatsApp-readable format.
 * Fields are shown in bold, arrays as bullet points, and nested objects are indented.
 * @param obj The JSON object to format.
 * @param indentLevel The current indentation level (for recursion).
 * @returns A WhatsApp-formatted string.
 */
export function jsonToWhatsapp(obj: any, indentLevel: number = 0): string {
  if (obj === null || obj === undefined) return '';

  const indent = '  '.repeat(indentLevel);
  const lines: string[] = [];

  // Handle primitive types
  if (typeof obj !== 'object') {
    return String(obj);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      if (typeof item === 'object' && item !== null) {
        // For object items in array, show index and recurse
        if (Array.isArray(item)) {
          lines.push(`${indent}${index + 1}. ${jsonToWhatsapp(item, indentLevel + 1)}`);
        } else {
          lines.push(`${indent}${index + 1}.`);
          lines.push(jsonToWhatsapp(item, indentLevel + 1));
        }
      } else {
        // For primitive items, use bullet points
        lines.push(`${indent}• ${item}`);
      }
    });
    return lines.join('\n');
  }

  // Handle objects
  Object.entries(obj).forEach(([key, value]) => {
    // Format key name (convert camelCase to Title Case)
    const formattedKey = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

    if (value === null || value === undefined || value === '') {
      // Skip empty values
      return;
    }

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          // Skip empty arrays
          return;
        }
        // Field name in bold, then list items
        lines.push(`${indent}*${formattedKey}:*`);
        lines.push(jsonToWhatsapp(value, indentLevel + 1));
      } else {
        // Nested object - show field name and recurse
        lines.push(`${indent}*${formattedKey}:*`);
        lines.push(jsonToWhatsapp(value, indentLevel + 1));
      }
    } else {
      // Primitive value - show in "Field: value" format with bold field
      lines.push(`${indent}*${formattedKey}:* ${value}`);
    }
  });

  return lines.join('\n');
}
