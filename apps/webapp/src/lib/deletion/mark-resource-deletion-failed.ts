import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';

import {
  DELETION_ERROR_MAX_LENGTH,
  formatDeletionErrorMessage,
} from './deletion-error-message';

export { DELETION_ERROR_MAX_LENGTH };

export function truncateDeletionError(error: unknown): string {
  return formatDeletionErrorMessage(error);
}

/** Mark a resource doc `failed` when delete did not complete and the doc still exists. */
export async function markResourceDeletionFailed(
  db: Firestore,
  docRef: DocumentReference,
  error: unknown
): Promise<boolean> {
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;
    await updateDoc(docRef, {
      deletionStatus: 'failed',
      deletionError: truncateDeletionError(error),
      deletionFailedAt: serverTimestamp(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function markDocumentDeletionFailed(
  db: Firestore,
  userId: string,
  docId: string,
  error: unknown
): Promise<boolean> {
  return markResourceDeletionFailed(db, doc(db, 'users', userId, 'docs', docId), error);
}

export async function markSessionDeletionFailed(
  db: Firestore,
  userId: string,
  sessionId: string,
  error: unknown
): Promise<boolean> {
  return markResourceDeletionFailed(db, doc(db, 'users', userId, 'chats', sessionId), error);
}

export async function markCheckpointDeletionFailed(
  db: Firestore,
  userId: string,
  propertyId: string,
  checkpointId: string,
  error: unknown
): Promise<boolean> {
  return markResourceDeletionFailed(
    db,
    doc(db, 'users', userId, 'properties', propertyId, 'checkpoints', checkpointId),
    error
  );
}

export async function markPropertyDeletionFailed(
  db: Firestore,
  userId: string,
  propertyId: string,
  error: unknown
): Promise<boolean> {
  return markResourceDeletionFailed(
    db,
    doc(db, 'users', userId, 'properties', propertyId),
    error
  );
}

export async function markResourcesDeletionFailed(
  db: Firestore,
  docRefs: DocumentReference[],
  error: unknown
): Promise<void> {
  const message = truncateDeletionError(error);
  await Promise.all(
    docRefs.map(async (docRef) => {
      try {
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        await updateDoc(docRef, {
          deletionStatus: 'failed',
          deletionError: message,
          deletionFailedAt: serverTimestamp(),
        });
      } catch {
        // best-effort per doc
      }
    })
  );
}
