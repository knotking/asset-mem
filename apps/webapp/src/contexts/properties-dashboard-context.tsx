'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Document as DocumentType, Property } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';

const propertiesLog = createLogger('properties');

type PropertiesDashboardContextType = {
  properties: Property[];
  /** True only until the first properties snapshot for the signed-in user. */
  loading: boolean;
};

const PropertiesDashboardContext = createContext<
  PropertiesDashboardContextType | undefined
>(undefined);

function sortProperties(props: Property[]): Property[] {
  return [...props].sort((a, b) => a.address.localeCompare(b.address));
}

export function PropertiesDashboardProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const subscribedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      subscribedUserIdRef.current = null;
      setProperties([]);
      setLoading(false);
      return;
    }

    const isSameUser = subscribedUserIdRef.current === user.uid;
    subscribedUserIdRef.current = user.uid;

    if (!isSameUser) {
      setProperties([]);
      setLoading(true);
    }

    const propertiesRef = collection(db, 'users', user.uid, 'properties');
    const q = query(propertiesRef, where('userId', '==', user.uid));

    const docUnsubscribes: Record<string, () => void> = {};
    const checkpointUnsubscribes: Record<string, () => void> = {};

    const unsubscribeProperties = onSnapshot(
      q,
      (querySnapshot) => {
        const props: Property[] = querySnapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Property)
        );
        const currentPropertyIds = new Set(props.map((p) => p.id));

        setProperties((prev) => {
          const prevById = new Map(prev.map((p) => [p.id, p]));
          return sortProperties(
            props.map((prop) => {
              const prevProp = prevById.get(prop.id);
              return {
                ...prop,
                documents: prevProp?.documents,
                docIds: prevProp?.docIds,
                docGsURIs: prevProp?.docGsURIs,
                checksCount: prevProp?.checksCount,
                servicesCount:
                  prop.servicesCount || prop.services || prevProp?.servicesCount || 0,
              };
            })
          );
        });
        setLoading(false);

        for (const prop of props) {
          const propertyId = prop.id;

          if (!docUnsubscribes[propertyId]) {
            const docsRef = collection(db, 'users', user.uid, 'docs');
            const docsQuery = query(docsRef, where('propertyId', '==', propertyId));
            docUnsubscribes[propertyId] = onSnapshot(docsQuery, (docsSnapshot) => {
              const documents = docsSnapshot.docs.map(
                (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as DocumentType
              );
              setProperties((prev) =>
                sortProperties(
                  prev.map((p) =>
                    p.id === propertyId
                      ? {
                          ...p,
                          documents,
                          docIds: documents.map((d) => d.id),
                          docGsURIs: documents
                            .map((d) => d.gsURI)
                            .filter((uri): uri is string => !!uri),
                        }
                      : p
                  )
                )
              );
            });
          }

          if (!checkpointUnsubscribes[propertyId]) {
            const checkpointsRef = collection(
              db,
              'users',
              user.uid,
              'properties',
              propertyId,
              'checkpoints'
            );
            checkpointUnsubscribes[propertyId] = onSnapshot(checkpointsRef, (snap) => {
              setProperties((prev) =>
                sortProperties(
                  prev.map((p) =>
                    p.id === propertyId ? { ...p, checksCount: snap.size } : p
                  )
                )
              );
            });
          }
        }

        for (const propertyId of Object.keys(docUnsubscribes)) {
          if (!currentPropertyIds.has(propertyId)) {
            docUnsubscribes[propertyId]();
            delete docUnsubscribes[propertyId];
          }
        }
        for (const propertyId of Object.keys(checkpointUnsubscribes)) {
          if (!currentPropertyIds.has(propertyId)) {
            checkpointUnsubscribes[propertyId]();
            delete checkpointUnsubscribes[propertyId];
          }
        }
      },
      (error) => {
        propertiesLog.error('fetch.failed', undefined, error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not fetch properties.',
        });
        setLoading(false);
      }
    );

    return () => {
      unsubscribeProperties();
      Object.values(docUnsubscribes).forEach((unsub) => unsub());
      Object.values(checkpointUnsubscribes).forEach((unsub) => unsub());
    };
  }, [user, authLoading, toast]);

  return (
    <PropertiesDashboardContext.Provider value={{ properties, loading }}>
      {children}
    </PropertiesDashboardContext.Provider>
  );
}

export function usePropertiesDashboard() {
  const context = useContext(PropertiesDashboardContext);
  if (context === undefined) {
    throw new Error(
      'usePropertiesDashboard must be used within a PropertiesDashboardProvider'
    );
  }
  return context;
}
