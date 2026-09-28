import type { UploadingDocument } from '@asset-mem/common/contexts/document-upload-context';
import type { Document } from '@asset-mem/common/types';

export type MergedPropertyDocument =
  | (UploadingDocument & { source: 'uploading' })
  | (Document & { source: 'firestore' });

/**
 * Merge optimistic in-memory uploads with Firestore docs without duplicates.
 * While analyzing, the same file exists in both lists (temp upload id + Firestore doc).
 */
export function mergePropertyDocuments(
  uploadingDocs: UploadingDocument[],
  documents: Document[]
): MergedPropertyDocument[] {
  const linkedFirestoreIds = new Set(
    uploadingDocs.map((doc) => doc.firestoreDocId).filter((id): id is string => !!id)
  );
  const linkedGsUris = new Set(
    uploadingDocs.map((doc) => doc.gsURI).filter((uri): uri is string => !!uri)
  );

  const firestoreOnly = documents.filter((doc) => {
    if (linkedFirestoreIds.has(doc.id)) {
      return false;
    }
    if (doc.gsURI && linkedGsUris.has(doc.gsURI)) {
      return false;
    }
    return true;
  });

  return [
    ...uploadingDocs.map((doc) => ({ ...doc, source: 'uploading' as const })),
    ...firestoreOnly.map((doc) => ({ ...doc, source: 'firestore' as const })),
  ];
}
