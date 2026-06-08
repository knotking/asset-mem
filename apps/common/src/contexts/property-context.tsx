import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import type { Document as DocumentType, Property } from '../types';
import { useAuth } from './auth-context';
import { useFirebase } from './firebase-context';
import { createLogger } from '../lib/logger';
import { useOptimisticDeletionOverlay } from '../hooks/use-optimistic-deletion-overlay';

const propertyLog = createLogger('property');

interface PropertyContextType {
  documents: DocumentType[];
  isLoading: boolean;
  property: Property | null;
  markDocumentsDeleting: (ids: string[]) => void;
  clearDocumentsDeleting: (ids: string[]) => void;
  isDocumentDeletingOverlay: (
    document: Pick<DocumentType, 'id' | 'deletionStatus'> | null | undefined
  ) => boolean;
}

interface PropertyProviderProps {
  children: React.ReactNode;
  propertyId: string | null | undefined;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export const PropertyProvider = ({ children, propertyId }: PropertyProviderProps) => {
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);
  const { user } = useAuth();
  const { db } = useFirebase();
  const isNewPropertyFlow = propertyId === 'new-property';
  const {
    markDeleting: markDocumentsDeleting,
    clearDeleting: clearDocumentsDeleting,
    isDeletingOverlay: isDocumentDeletingOverlay,
  } = useOptimisticDeletionOverlay();

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
      propertyLog.error("documents.fetch.failed", undefined, error);
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
        propertyLog.error("property.fetch.failed", undefined, error);
        setProperty(null);
        setIsLoading(false);
    });


    return () => {
      unsubscribeDocs();
      unsubscribeProp();
    };
  }, [user, propertyId, isNewPropertyFlow]);


  return (
    <PropertyContext.Provider
      value={{
        documents,
        isLoading,
        property,
        markDocumentsDeleting,
        clearDocumentsDeleting,
        isDocumentDeletingOverlay,
      }}>
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
