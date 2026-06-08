import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore';

/** Firestore batch write limit is 500; stay under for headroom. */
export const FIRESTORE_BATCH_SIZE = 450;

/** Delete all docs in a collection using chunked batches (handles >500 docs). */
export async function deleteAllInCollection(
  db: Firestore,
  collectionRef: CollectionReference
): Promise<number> {
  const snap = await getDocs(query(collectionRef));
  if (snap.empty) return 0;

  for (let i = 0; i < snap.docs.length; i += FIRESTORE_BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + FIRESTORE_BATCH_SIZE).forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  }
  return snap.size;
}

/** Delete a document and all immediate subcollections (one level deep per subcollection name). */
export async function deleteDocumentWithSubcollections(
  db: Firestore,
  docRef: DocumentReference,
  subcollectionNames: string[]
): Promise<void> {
  for (const name of subcollectionNames) {
    await deleteAllInCollection(db, collection(docRef, name));
  }
  await deleteDoc(docRef);
}
