'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './auth-context';
import { useProperty } from './property-context';
import { useFirebase } from './firebase-context';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { Document } from '@/lib/types';

interface InspectionContextType {
  inspections: Document[];
  loading: boolean;
  selectedInspection: Document | null;
  setSelectedInspection: (inspection: Document | null) => void;
}

const InspectionContext = createContext<InspectionContextType | undefined>(undefined);

export const InspectionProvider = ({ children }: { children: ReactNode }) => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { property } = useProperty();
  const [inspections, setInspections] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState<Document | null>(null);

  useEffect(() => {
    if (!user || !property) {
      setInspections([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, `users/${user.uid}/properties/${property.id}/documents`),
      where('documentType', '==', 'INSPECTION_REPORT'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const inspectionData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Document[];

        setInspections(inspectionData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching inspection reports:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user, property]);

  const value = {
    inspections,
    loading,
    selectedInspection,
    setSelectedInspection,
  };

  return <InspectionContext.Provider value={value}>{children}</InspectionContext.Provider>;
};

export const useInspection = () => {
  const context = useContext(InspectionContext);
  if (context === undefined) {
    throw new Error('useInspection must be used within an InspectionProvider');
  }
  return context;
};
