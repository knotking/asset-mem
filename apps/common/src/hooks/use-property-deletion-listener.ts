import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
} from 'firebase/firestore';

export type PropertyDeletionWatch = {
  propertyId: string;
  name?: string;
  deletionStatus?: 'deleting' | 'failed';
  deletionJobId?: string;
  deletionError?: string;
};

/** Tracks properties with in-flight or failed deletion for list UI and toasts. */
export function usePropertyDeletionListener(
  db: Firestore | null,
  userId: string | undefined
) {
  const [watches, setWatches] = useState<PropertyDeletionWatch[]>([]);

  useEffect(() => {
    if (!db || !userId) {
      setWatches([]);
      return;
    }
    const q = query(collection(db, 'users', userId, 'properties'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const items: PropertyDeletionWatch[] = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        const status = data.deletionStatus as 'deleting' | 'failed' | undefined;
        if (status === 'deleting' || status === 'failed') {
          items.push({
            propertyId: d.id,
            name: data.name as string | undefined,
            deletionStatus: status,
            deletionJobId: data.deletionJobId as string | undefined,
            deletionError: data.deletionError as string | undefined,
          });
        }
      });
      setWatches(items);
    });
    return unsub;
  }, [db, userId]);

  return watches;
}
