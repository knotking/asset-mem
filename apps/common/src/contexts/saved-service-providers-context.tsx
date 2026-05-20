/**
 * Property-scoped saved service providers (Firestore + React context).
 * **mapp** imports this module. **webapp** keeps a copy at
 * `apps/webapp/src/contexts/saved-service-providers-context.tsx` — update both when changing behavior.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import type {
  SaveServiceProviderMeta,
  SaveServiceProviderResult,
  SavedServiceProvider,
  ServiceProvider,
} from '../types';
import {
  buildServiceProviderDedupeKey,
  stripUndefinedForFirestore,
} from '../lib/saved-service-provider-dedupe';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';
import { createLogger } from '../lib/logger';

const savedProvidersLog = createLogger('saved-service-providers');

interface SavedServiceProvidersContextType {
  savedProviders: SavedServiceProvider[];
  loading: boolean;
  isSaved: (provider: ServiceProvider) => boolean;
  saveProvider: (
    provider: ServiceProvider,
    meta?: SaveServiceProviderMeta
  ) => Promise<SaveServiceProviderResult>;
  removeProvider: (id: string) => Promise<void>;
}

const SavedServiceProvidersContext = createContext<
  SavedServiceProvidersContextType | undefined
>(undefined);

interface SavedServiceProvidersProviderProps {
  children: ReactNode;
  propertyId: string | null | undefined;
}

export const SavedServiceProvidersProvider = ({
  children,
  propertyId,
}: SavedServiceProvidersProviderProps) => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const [savedProviders, setSavedProviders] = useState<SavedServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !propertyId || propertyId === 'new-property') {
      setSavedProviders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const colRef = collection(
      db,
      'users',
      user.uid,
      'properties',
      propertyId,
      'savedProviders'
    );
    const q = query(colRef, orderBy('savedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
          } as SavedServiceProvider;
        });
        setSavedProviders(rows);
        setLoading(false);
      },
      (error) => {
        savedProvidersLog.error('savedProviders.listen.failed', undefined, error);
        setSavedProviders([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user?.uid, propertyId]);

  const dedupeIndex = useMemo(() => {
    const map = new Map<string, SavedServiceProvider>();
    for (const row of savedProviders) {
      if (row.dedupeKey) {
        map.set(row.dedupeKey, row);
      }
    }
    return map;
  }, [savedProviders]);

  const isSaved = useCallback(
    (provider: ServiceProvider) => {
      const key = buildServiceProviderDedupeKey(provider);
      return dedupeIndex.has(key);
    },
    [dedupeIndex]
  );

  const saveProvider = useCallback(
    async (
      provider: ServiceProvider,
      meta?: SaveServiceProviderMeta
    ): Promise<SaveServiceProviderResult> => {
      if (!user?.uid || !propertyId || propertyId === 'new-property') {
        return 'error';
      }

      const dedupeKey = buildServiceProviderDedupeKey(provider);
      if (dedupeIndex.has(dedupeKey)) {
        return 'already_saved';
      }

      try {
        const colRef = collection(
          db,
          'users',
          user.uid,
          'properties',
          propertyId,
          'savedProviders'
        );
        await addDoc(
          colRef,
          stripUndefinedForFirestore({
            ...provider,
            propertyId,
            userId: user.uid,
            dedupeKey,
            savedAt: serverTimestamp(),
            source: meta?.source ?? 'chat',
            sessionId: meta?.sessionId,
            messageId: meta?.messageId,
            checkpointId: meta?.checkpointId,
            searchContext: meta?.searchContext,
          })
        );
        return 'saved';
      } catch (error) {
        savedProvidersLog.error('savedProviders.save.failed', undefined, error);
        return 'error';
      }
    },
    [db, dedupeIndex, propertyId, user?.uid]
  );

  const removeProvider = useCallback(
    async (id: string) => {
      if (!user?.uid || !propertyId || propertyId === 'new-property') {
        return;
      }
      try {
        await deleteDoc(
          doc(db, 'users', user.uid, 'properties', propertyId, 'savedProviders', id)
        );
      } catch (error) {
        savedProvidersLog.error('savedProviders.remove.failed', undefined, error);
        throw error;
      }
    },
    [db, propertyId, user?.uid]
  );

  const value = useMemo(
    () => ({
      savedProviders,
      loading,
      isSaved,
      saveProvider,
      removeProvider,
    }),
    [savedProviders, loading, isSaved, saveProvider, removeProvider]
  );

  return (
    <SavedServiceProvidersContext.Provider value={value}>
      {children}
    </SavedServiceProvidersContext.Provider>
  );
};

export const useSavedServiceProviders = () => {
  const context = useContext(SavedServiceProvidersContext);
  if (context === undefined) {
    throw new Error(
      'useSavedServiceProviders must be used within a SavedServiceProvidersProvider'
    );
  }
  return context;
};

/** Maps Firestore timestamp fields when reading outside the live listener. */
export function savedProviderSavedAtDate(savedAt: Timestamp | undefined): Date | null {
  if (!savedAt) return null;
  if (typeof (savedAt as { toDate?: () => Date }).toDate === 'function') {
    return (savedAt as { toDate: () => Date }).toDate();
  }
  return null;
}
