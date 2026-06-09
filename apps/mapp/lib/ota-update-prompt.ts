import * as Updates from 'expo-updates';
import { showThemedAlert, showThemedConfirm } from '@/contexts/themed-alert-context';

export type OtaUpdateReadyPromptOptions = {
  /** Dev-only: same UI as production; Restart does not call expo-updates. */
  mock?: boolean;
};

export function showOtaUpdateReadyPrompt(options?: OtaUpdateReadyPromptOptions): void {
  const mock = options?.mock === true;

  showThemedConfirm({
    title: mock ? 'Update ready (mock)' : 'Update ready',
    message: mock
      ? 'Dev mock of the OTA prompt. Restart will not apply a real update.'
      : 'A new version has been downloaded. Restart now to apply it?',
    confirmText: 'Restart',
    cancelText: 'Later',
    onConfirm: () => {
      if (mock) {
        showThemedAlert('Mock restart', 'On a release build, the app would reload now.');
        return;
      }
      void Updates.reloadAsync();
    },
  });
}

export function isOtaDevMockAvailable(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
