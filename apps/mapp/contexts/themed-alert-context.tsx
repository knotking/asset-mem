import * as React from 'react';
import { AlertDialogWrapper } from '@/components/property-details/AlertDialogWrapper';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  confirmVariant?: 'default' | 'destructive';
};

type AlertState = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  showCancel: boolean;
  onConfirm?: () => void;
  confirmVariant: 'default' | 'destructive';
};

const closedState: AlertState = {
  open: false,
  title: '',
  message: '',
  confirmText: 'OK',
  cancelText: 'Cancel',
  showCancel: false,
  confirmVariant: 'default',
};

type ThemedAlertContextValue = {
  showAlert: (title: string, message: string) => void;
  showConfirm: (options: ConfirmOptions) => void;
};

const ThemedAlertContext = React.createContext<ThemedAlertContextValue | null>(null);

let themedAlertBridge: ThemedAlertContextValue | null = null;

/** For hooks and libs outside React tree (e.g. document upload, OTA). */
export function showThemedAlert(title: string, message: string): void {
  themedAlertBridge?.showAlert(title, message);
}

export function showThemedConfirm(options: ConfirmOptions): void {
  themedAlertBridge?.showConfirm(options);
}

export function ThemedAlertProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AlertState>(closedState);

  const showAlert = React.useCallback((title: string, message: string) => {
    setState({
      ...closedState,
      open: true,
      title,
      message,
    });
  }, []);

  const showConfirm = React.useCallback((options: ConfirmOptions) => {
    setState({
      open: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'OK',
      cancelText: options.cancelText ?? 'Cancel',
      showCancel: true,
      onConfirm: options.onConfirm,
      confirmVariant: options.confirmVariant ?? 'default',
    });
  }, []);

  const value = React.useMemo(
    () => ({ showAlert, showConfirm }),
    [showAlert, showConfirm]
  );

  React.useEffect(() => {
    themedAlertBridge = value;
    return () => {
      themedAlertBridge = null;
    };
  }, [value]);

  return (
    <ThemedAlertContext.Provider value={value}>
      {children}
      <AlertDialogWrapper
        open={state.open}
        onOpenChange={(open) => {
          if (!open) setState(closedState);
        }}
        title={state.title}
        description={state.message}
        confirmText={state.confirmText}
        cancelText={state.cancelText}
        showCancel={state.showCancel}
        confirmVariant={state.confirmVariant}
        onConfirm={
          state.showCancel
            ? () => {
                state.onConfirm?.();
                setState(closedState);
              }
            : undefined
        }
      />
    </ThemedAlertContext.Provider>
  );
}

export function useThemedAlert(): ThemedAlertContextValue {
  const context = React.useContext(ThemedAlertContext);
  if (!context) {
    throw new Error('useThemedAlert must be used within ThemedAlertProvider');
  }
  return context;
}
