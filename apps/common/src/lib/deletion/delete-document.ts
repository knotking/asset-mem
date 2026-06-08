import { deleteDoc, doc, type Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { GetFirebaseIdToken } from '../correlation-id';
import { deleteDocumentViaProxy } from './api-client';
import { deleteStoragePath } from './storage-paths';
import { emptyDeletionResult, type DeletionResult } from './types';

export type DeleteDocumentParams = {
  db: Firestore;
  storage: FirebaseStorage;
  userId: string;
  docId: string;
  storagePath?: string | null;
  gsURI?: string | null;
  documentDeleteUrl?: string;
  getIdToken?: GetFirebaseIdToken;
};

export async function deleteDocumentAsset(
  params: DeleteDocumentParams
): Promise<DeletionResult> {
  if (params.documentDeleteUrl && params.getIdToken) {
    return deleteDocumentViaProxy({
      url: params.documentDeleteUrl,
      getIdToken: params.getIdToken,
      userId: params.userId,
      docId: params.docId,
      storagePath: params.storagePath,
      gsURI: params.gsURI,
    });
  }

  const result = emptyDeletionResult();
  if (params.storagePath && params.storage) {
    const storageOutcome = await deleteStoragePath(params.storage, params.storagePath);
    if (storageOutcome.ok) {
      result.deleted.push(`storage:${params.storagePath}`);
    } else {
      result.ok = false;
      result.failed.push({
        resource: `storage:${params.storagePath}`,
        message: storageOutcome.message ?? 'failed',
      });
    }
  }
  try {
    await deleteDoc(doc(params.db, 'users', params.userId, 'docs', params.docId));
    result.deleted.push(`firestore:docs/${params.docId}`);
  } catch (err) {
    result.ok = false;
    result.failed.push({
      resource: `firestore:docs/${params.docId}`,
      message: err instanceof Error ? err.message : 'Firestore delete failed',
    });
  }
  return result;
}
