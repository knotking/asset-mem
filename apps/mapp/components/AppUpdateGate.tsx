import * as React from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import * as Updates from 'expo-updates';
import {
  fetchMobileAppUpdatePolicy,
  getStoreUrlForPlatform,
  isNativeUpdateRequired,
  type MobileAppUpdatePolicy,
} from '@/lib/app-update-policy';
import { getNativeAppVersion } from '@/lib/native-app-version';
import { isOtaDevMockAvailable, showOtaUpdateReadyPrompt } from '@/lib/ota-update-prompt';
import { createLogger } from '@/lib/logger';
import { AppUpdateBlocker } from '@/components/AppUpdateBlocker';

const otaLog = createLogger('ota-updates');
const OTA_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export type AppUpdateDevOverride = null | 'forceNative' | 'forceOta' | 'forceOtaDownloading';

type AppUpdateGateContextValue = {
  setDevOverride: (override: AppUpdateDevOverride) => void;
};

const AppUpdateGateContext = React.createContext<AppUpdateGateContextValue | null>(null);

export function useAppUpdateDevControls(): AppUpdateGateContextValue | null {
  return React.useContext(AppUpdateGateContext);
}

type OtaGatePhase = 'idle' | 'checking' | 'downloading' | 'ready' | 'error';

type AppUpdateGateProps = {
  children: React.ReactNode;
  /** When false, skip OTA checks (e.g. auth still loading). */
  enabled: boolean;
};

export function AppUpdateGate({ children, enabled }: AppUpdateGateProps) {
  const [policy, setPolicy] = React.useState<MobileAppUpdatePolicy | null>(null);
  const [devOverride, setDevOverride] = React.useState<AppUpdateDevOverride>(null);
  const [otaPhase, setOtaPhase] = React.useState<OtaGatePhase>('idle');
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const isCheckingRef = React.useRef(false);
  const hasSoftPromptedRef = React.useRef(false);
  const lastCheckedAtRef = React.useRef(0);

  const refreshPolicy = React.useCallback(async () => {
    const next = await fetchMobileAppUpdatePolicy();
    setPolicy(next);
    return next;
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    void refreshPolicy();
  }, [enabled, refreshPolicy]);

  const runOtaCheck = React.useCallback(
    async (force = false) => {
      if (!enabled || !policy || !Updates.isEnabled) return;
      if (isCheckingRef.current) return;
      if (devOverride) return;

      const now = Date.now();
      if (!force && now - lastCheckedAtRef.current < OTA_CHECK_INTERVAL_MS) return;
      lastCheckedAtRef.current = now;
      isCheckingRef.current = true;

      try {
        setOtaPhase('checking');
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) {
          setOtaPhase('idle');
          return;
        }

        if (policy.forceOta) {
          setOtaPhase('downloading');
          await Updates.fetchUpdateAsync();
          setOtaPhase('ready');
          return;
        }

        setOtaPhase('downloading');
        await Updates.fetchUpdateAsync();
        setOtaPhase('idle');

        if (!hasSoftPromptedRef.current) {
          hasSoftPromptedRef.current = true;
          showOtaUpdateReadyPrompt();
        }
      } catch (error) {
        otaLog.debug('check.failed', undefined, error);
        setOtaPhase(policy.forceOta ? 'error' : 'idle');
      } finally {
        isCheckingRef.current = false;
      }
    },
    [devOverride, enabled, policy]
  );

  React.useEffect(() => {
    if (!enabled || !policy) return;
    void runOtaCheck(true);
  }, [enabled, policy, runOtaCheck]);

  React.useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasInBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextAppState;

      if (wasInBackground && nextAppState === 'active') {
        void refreshPolicy().then(() => runOtaCheck());
      }
    });

    return () => subscription.remove();
  }, [enabled, refreshPolicy, runOtaCheck]);

  const openStore = React.useCallback(() => {
    if (!policy) return;
    const url = getStoreUrlForPlatform(policy);
    if (url) void Linking.openURL(url);
  }, [policy]);

  const applyOtaRestart = React.useCallback(() => {
    if (devOverride === 'forceOta' || devOverride === 'forceOtaDownloading') {
      setDevOverride(null);
      showOtaUpdateReadyPrompt({ mock: true });
      return;
    }
    void Updates.reloadAsync();
  }, [devOverride]);

  const contextValue = React.useMemo<AppUpdateGateContextValue>(
    () => ({ setDevOverride }),
    []
  );

  const nativeRequired =
    devOverride === 'forceNative' || (policy != null && isNativeUpdateRequired(policy));
  const forceOtaActive =
    devOverride === 'forceOta' ||
    devOverride === 'forceOtaDownloading' ||
    (policy?.forceOta === true && (otaPhase === 'downloading' || otaPhase === 'ready' || otaPhase === 'error'));

  if (nativeRequired) {
    const installed = getNativeAppVersion();
    const minimum = policy?.minimumNativeVersion ?? '9.9.9';
    const message =
      policy?.message ??
      (devOverride === 'forceNative'
        ? 'Dev mock: this screen blocks the app until you open the store.'
        : `Installed ${installed}. Please update to ${minimum} or later to continue.`);

    return (
      <AppUpdateGateContext.Provider value={contextValue}>
        <AppUpdateBlocker
          title="Update required"
          message={message}
          primaryLabel="Open app store"
          onPrimaryPress={openStore}
          secondaryLabel={isOtaDevMockAvailable() ? 'Dismiss mock' : undefined}
          onSecondaryPress={
            isOtaDevMockAvailable() ? () => setDevOverride(null) : undefined
          }
        />
      </AppUpdateGateContext.Provider>
    );
  }

  if (forceOtaActive) {
    const isDevMock =
      devOverride === 'forceOta' || devOverride === 'forceOtaDownloading';
    const downloading =
      devOverride === 'forceOtaDownloading' || otaPhase === 'downloading' || otaPhase === 'checking';
    const errored = !isDevMock && otaPhase === 'error';

    return (
      <AppUpdateGateContext.Provider value={contextValue}>
        <AppUpdateBlocker
          title="Update required"
          message={
            errored
              ? 'Could not download the update. Check your connection and try again.'
              : downloading
                ? 'Downloading the latest version. Please wait…'
                : 'A new version is ready. Restart to continue.'
          }
          primaryLabel={downloading ? 'Please wait…' : 'Restart now'}
          onPrimaryPress={downloading ? () => {} : applyOtaRestart}
          loading={downloading}
          secondaryLabel={
            errored ? 'Retry' : isOtaDevMockAvailable() ? 'Dismiss mock' : undefined
          }
          onSecondaryPress={
            errored
              ? () => void runOtaCheck(true)
              : isOtaDevMockAvailable()
                ? () => setDevOverride(null)
                : undefined
          }
        />
      </AppUpdateGateContext.Provider>
    );
  }

  return (
    <AppUpdateGateContext.Provider value={contextValue}>{children}</AppUpdateGateContext.Provider>
  );
}
