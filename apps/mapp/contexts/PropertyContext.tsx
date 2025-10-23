import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { app, auth, storage, db, firebaseConfig } from '../../common/src/firebase-native';
import { useAuth } from './AuthContext';

export interface Property {
  id: string;
  address: string;
  cityStateZip: string;
  docs: number;
  services: number;
  checks: number;
  name: string;
  propertyType: string;
  createdAt: any;
  userId: string;
}

interface PropertyContextType {
  properties: Property[];
  loading: boolean;
  error: string | null;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (isAuthLoading) {
      return; // Wait for auth state to be determined
    }

    if (!user) {
      console.log('No user logged in, cannot fetch properties.');
      setProperties([]);
      setLoading(false);
      return;
    }
    console.log('In Property Context, DB:', app, db);
    const propertiesRef = collection(db, `users/${user.uid}/properties`);
    const q = query(propertiesRef, orderBy('createdAt', 'desc'));

    const docUnsubscribes: { [key: string]: () => void } = {};

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
            checks: propertyData.checks || 0,
            name: propertyData.name,
            propertyType: propertyData.propertyType,
            createdAt: propertyData.createdAt,
            userId: propertyData.userId,
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
        });

        // Clean up docs listeners for properties that are no longer in the snapshot
        Object.keys(docUnsubscribes).forEach((propertyId) => {
          if (!currentPropertyIds.has(propertyId)) {
            docUnsubscribes[propertyId](); // Unsubscribe
            delete docUnsubscribes[propertyId];
          }
        });

        setProperties(newProperties);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to fetch properties: ', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeProperties();
      // Unsubscribe all docs listeners on cleanup
      Object.values(docUnsubscribes).forEach((unsubscribe) => unsubscribe());
    };
  }, [user, isAuthLoading]);

  return (
    <PropertyContext.Provider value={{ properties, loading, error }}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperties must be used within a PropertyProvider');
  }
  return context;
}
