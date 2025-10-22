import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from './AuthContext';
import { Document } from '@/app/types';

interface DocumentContextType {
  documents: Document[];
  loading: boolean;
  error: string | null;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({
  children,
  propertyId,
}: {
  children: ReactNode;
  propertyId: string;
}) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    if (isAuthLoading || !propertyId) {
      return; // Wait for auth state and propertyId
    }

    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const docsRef = collection(db, `users/${user.uid}/docs`);
    const q = query(docsRef, where('propertyId', '==', propertyId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newDocuments: Document[] = snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Document
        );
        setDocuments(newDocuments);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Failed to fetch documents: ', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAuthLoading, propertyId]);

  return (
    <DocumentContext.Provider value={{ documents, loading, error }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
}
