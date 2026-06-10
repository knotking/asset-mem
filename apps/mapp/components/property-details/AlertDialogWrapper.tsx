import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Loader2 } from 'lucide-react-native';
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
  confirmLoading?: boolean;
  /** Use `destructive` for delete/remove confirms; defaults to `default` (primary). */
  confirmVariant?: 'default' | 'destructive';
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
  confirmLoading = false,
  confirmVariant = 'default',
}: AlertDialogWrapperProps) {
  const confirmLoadingRef = React.useRef(false);

  React.useEffect(() => {
    if (!confirmLoading) {
      confirmLoadingRef.current = false;
    }
  }, [confirmLoading]);

  return (
    <AlertDialog
      open={open || confirmLoading}
      onOpenChange={(next) => {
        if (confirmLoadingRef.current || confirmLoading) return;
        onOpenChange(next);
      }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {typeof description === 'string' ? description : description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {showCancel && (
            <AlertDialogCancel disabled={confirmLoading}>
              <Text>{cancelText}</Text>
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            variant={confirmVariant}
            disabled={confirmLoading}
            onPress={() => {
              if (confirmLoading) return;
              if (onConfirm) {
                if (confirmLoadingRef.current) return;
                confirmLoadingRef.current = true;
                onConfirm();
                return;
              }
              onOpenChange(false);
            }}>
            {confirmLoading ? (
              <View className="flex-row items-center gap-2">
                <Icon
                  as={Loader2}
                  size={16}
                  className={
                    confirmVariant === 'destructive'
                      ? 'animate-spin text-white'
                      : 'animate-spin text-primary-foreground'
                  }
                />
                <Text>Deleting…</Text>
              </View>
            ) : (
              <Text>{confirmText}</Text>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
