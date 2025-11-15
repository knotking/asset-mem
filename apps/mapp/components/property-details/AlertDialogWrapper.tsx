import * as React from 'react';
import { Text } from '@/components/ui/text';
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

interface AlertDialogWrapperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
}

export function AlertDialogWrapper({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  showCancel = false,
}: AlertDialogWrapperProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {typeof description === 'string' ? description : description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {showCancel && (
            <AlertDialogCancel>
              <Text>{cancelText}</Text>
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onPress={() => {
              if (onConfirm) {
                onConfirm();
              } else {
                onOpenChange(false);
              }
            }}>
            <Text>{confirmText}</Text>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
