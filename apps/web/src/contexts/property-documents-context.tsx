
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Document as DocumentType } from '@/lib/types';
import { useProperty } from './property-context';

interface PropertyDocumentsContextType {
  selectedDocuments: DocumentType[];
  handleDocumentSelect: (doc: DocumentType) => void;
  clearSelectedDocuments: () => void;
}

const PropertyDocumentsContext = createContext<PropertyDocumentsContextType | undefined>(undefined);

export const PropertyDocumentsProvider = ({ children }: { children: React.ReactNode }) => {
  const { documents } = useProperty();
  const [selectedDocuments, setSelectedDocuments] = useState<DocumentType[]>([]);

  useEffect(() => {
      // This initialization ensures all docs are selected by default.
      if (documents) {
        setSelectedDocuments(documents);
      }
  }, [documents]);


  const handleDocumentSelect = useCallback((doc: DocumentType) => {
    setSelectedDocuments(prev => {
      const isSelected = prev.some(d => d.id === doc.id);
      if (isSelected) {
        return prev.filter(d => d.id !== doc.id);
      } else {
        return [...prev, doc];
      }
    });
  }, []);

  const clearSelectedDocuments = useCallback(() => {
    setSelectedDocuments([]);
  }, []);

  return (
    <PropertyDocumentsContext.Provider value={{ selectedDocuments, handleDocumentSelect, clearSelectedDocuments }}>
      {children}
    </PropertyDocumentsContext.Provider>
  );
};

export const usePropertyDocuments = () => {
  const context = useContext(PropertyDocumentsContext);
  if (context === undefined) {
    throw new Error('usePropertyDocuments must be used within a PropertyDocumentsProvider');
  }
  return context;
};
