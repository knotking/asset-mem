
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmationPromise {
  resolve: (value: boolean) => void;
  newAddress: string;
}

interface AddressConfirmationContextType {
  confirm: (newAddress: string) => Promise<boolean>;
}

const AddressConfirmationContext = createContext<AddressConfirmationContextType | undefined>(undefined);

export const AddressConfirmationProvider = ({ children }: { children: React.ReactNode }) => {
  const [confirmation, setConfirmation] = useState<ConfirmationPromise | null>(null);

  const confirm = useCallback((newAddress: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmation({ resolve, newAddress });
    });
  }, []);

  const handleClose = (shouldUpdate: boolean) => {
    confirmation?.resolve(shouldUpdate);
    setConfirmation(null);
  };

  return (
    <AddressConfirmationContext.Provider value={{ confirm }}>
      {children}
      {confirmation && (
        <AlertDialog open={!!confirmation} onOpenChange={(isOpen) => !isOpen && handleClose(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>New Address Detected</AlertDialogTitle>
              <AlertDialogDescription>
                A new address was found: <strong className="text-foreground">{confirmation.newAddress}</strong>.
                <br /><br />
                Would you like to update the property's address to this one?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleClose(false)}>No, Keep Current</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleClose(true)}>Yes, Update</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </AddressConfirmationContext.Provider>
  );
};

export const useAddressConfirmation = () => {
  const context = useContext(AddressConfirmationContext);
  if (context === undefined) {
    throw new Error('useAddressConfirmation must be used within an AddressConfirmationProvider');
  }
  return context;
};
