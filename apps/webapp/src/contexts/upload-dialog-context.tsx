
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface UploadDialogContextType {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

const UploadDialogContext = createContext<UploadDialogContextType | undefined>(undefined);

export const UploadDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const onOpen = useCallback(() => setIsOpen(true), []);
  const onClose = useCallback(() => setIsOpen(false), []);

  return (
    <UploadDialogContext.Provider value={{ isOpen, onOpen, onClose }}>
      {children}
    </UploadDialogContext.Provider>
  );
};

export const useUploadDialog = () => {
  const context = useContext(UploadDialogContext);
  if (context === undefined) {
    throw new Error('useUploadDialog must be used within an UploadDialogProvider');
  }
  return context;
};
