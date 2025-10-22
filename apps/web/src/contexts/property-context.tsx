
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Document as DocumentType, Property } from '@/lib/types';
import { useAuth } from './auth-context';
import { useParams } from 'next/navigation';

interface PropertyContextType {
  documents: DocumentType[];
  isLoading: boolean;
  property: Property | null;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export const PropertyProvider = ({ children }: { children: React.ReactNode }) => {
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);
  const { user } = useAuth();
  const params = useParams();
  const propertyId = params.propertyId as string;
  const isNewPropertyFlow = propertyId === 'new-property';

  useEffect(() => {
    if (!user || isNewPropertyFlow || !propertyId) {
      setDocuments([]);
      setProperty(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Listener for documents associated with the property
    const docsRef = collection(db, 'users', user.uid, 'docs');
    const docsQuery = query(docsRef, where('propertyId', '==', propertyId));

    const unsubscribeDocs = onSnapshot(docsQuery, (querySnapshot) => {
      const docs = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as DocumentType));
      setDocuments(docs);
      // We set loading to false here, but property might still be loading
    }, (error) => {
      console.error("Error fetching documents for context:", error);
      setIsLoading(false);
    });

    // Listener for the property itself
    const propRef = doc(db, 'users', user.uid, 'properties', propertyId);
    const unsubscribeProp = onSnapshot(propRef, (docSnap) => {
        if (docSnap.exists()) {
            setProperty({ id: docSnap.id, ...docSnap.data() } as Property);
        } else {
            setProperty(null);
        }
        setIsLoading(false); // Loading is complete once we have property info
    }, (error) => {
        console.error("Error fetching property for context:", error);
        setProperty(null);
        setIsLoading(false);
    });


    return () => {
      unsubscribeDocs();
      unsubscribeProp();
    };
  }, [user, propertyId, isNewPropertyFlow]);


  return (
    <PropertyContext.Provider value={{ documents, isLoading, property }}>
      {children}
    </PropertyContext.Provider>
  );
};

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
};
