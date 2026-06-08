import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import type { Property } from '../types';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';
import { createLogger } from '../lib/logger';

const propertiesLog = createLogger('properties');

interface PropertiesListContextType {
  properties: Property[];
  loading: boolean;
  error: string | null;
}

const PropertiesListContext = createContext<PropertiesListContextType | undefined>(undefined);

export function PropertiesListProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: isAuthLoading } = useAuth();
  const { db } = useFirebase();

  useEffect(() => {
    if (isAuthLoading) {
      return; // Wait for auth state to be determined
    }

    if (!user) {
      propertiesLog.debug('fetch.skipped.noUser');
      setProperties([]);
      setLoading(false);
      return;
    }

    const propertiesRef = collection(db, `users/${user.uid}/properties`);
    const q = query(propertiesRef, orderBy('createdAt', 'desc'));

    const docUnsubscribes: { [key: string]: () => void } = {};
    const checkpointUnsubscribes: { [key: string]: () => void } = {};

    const unsubscribeProperties = onSnapshot(
      q,
      (snapshot) => {
        const newProperties: Property[] = [];
        const currentPropertyIds = new Set<string>();

        snapshot.docs.forEach((propertyDoc) => {
          const propertyId = propertyDoc.id;
          currentPropertyIds.add(propertyId);

          const propertyData = propertyDoc.data();

          const baseProperty: Omit<Property, 'docs'> = {
            id: propertyId,
            address: propertyData.address,
            cityStateZip: propertyData.address.split(', ')[1] || '',
            services: propertyData.services || 0,
            checks: 0,
            name: propertyData.name,
            propertyType: propertyData.propertyType,
            propertySubType: propertyData.propertySubType,
            createdAt: propertyData.createdAt,
            userId: propertyData.userId,
            deletionStatus: propertyData.deletionStatus,
            deletionJobId: propertyData.deletionJobId,
            deletionRequestedAt: propertyData.deletionRequestedAt,
            deletionError: propertyData.deletionError,
          };

          // Initialize docs to 0, will be updated by its own listener
          newProperties.push({ ...baseProperty, docs: 0 });

          // Set up or update docs listener for this property
          if (!docUnsubscribes[propertyId]) {
            const docsRef = collection(db, `users/${user.uid}/docs`);
            const docsQuery = query(docsRef, where('propertyId', '==', propertyId));

            const unsubscribeDocs = onSnapshot(docsQuery, (docsSnapshot) => {
              const docsCount = docsSnapshot.size;
              setProperties((prevProperties) =>
                prevProperties.map((prop) =>
                  prop.id === propertyId ? { ...prop, docs: docsCount } : prop
                )
              );
            });
            docUnsubscribes[propertyId] = unsubscribeDocs;
          }

          // Set up or update checkpoints listener for this property
          if (!checkpointUnsubscribes[propertyId]) {
            const checkpointsRef = collection(
              db,
              `users/${user.uid}/properties/${propertyId}/checkpoints`
            );

            const unsubscribeCheckpoints = onSnapshot(checkpointsRef, (checkpointsSnapshot) => {
              const checksCount = checkpointsSnapshot.size;
              setProperties((prevProperties) =>
                prevProperties.map((prop) =>
                  prop.id === propertyId ? { ...prop, checks: checksCount } : prop
                )
              );
            });
            checkpointUnsubscribes[propertyId] = unsubscribeCheckpoints;
          }
        });

        // Clean up docs listeners for properties that are no longer in the snapshot
        Object.keys(docUnsubscribes).forEach((propertyId) => {
          if (!currentPropertyIds.has(propertyId)) {
            docUnsubscribes[propertyId](); // Unsubscribe
            delete docUnsubscribes[propertyId];
          }
        });

        // Clean up checkpoint listeners for properties that are no longer in the snapshot
        Object.keys(checkpointUnsubscribes).forEach((propertyId) => {
          if (!currentPropertyIds.has(propertyId)) {
            checkpointUnsubscribes[propertyId]();
            delete checkpointUnsubscribes[propertyId];
          }
        });

        setProperties((prevProperties) => {
          const prevById = new Map(prevProperties.map((prop) => [prop.id, prop]));
          return newProperties.map((prop) => {
            const prev = prevById.get(prop.id);
            if (!prev) {
              return prop;
            }
            return {
              ...prop,
              docs: prev.docs ?? prop.docs,
              checks: prev.checks ?? prop.checks,
            };
          });
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        propertiesLog.error('fetch.failed', undefined, err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeProperties();
      // Unsubscribe all docs listeners on cleanup
      Object.values(docUnsubscribes).forEach((unsubscribe) => unsubscribe());
      Object.values(checkpointUnsubscribes).forEach((unsubscribe) => unsubscribe());
    };
  }, [user, isAuthLoading, db]);

  return (
    <PropertiesListContext.Provider value={{ properties, loading, error }}>
      {children}
    </PropertiesListContext.Provider>
  );
}

export function usePropertiesList() {
  const context = useContext(PropertiesListContext);
  if (context === undefined) {
    throw new Error('usePropertiesList must be used within a PropertiesListProvider');
  }
  return context;
}
