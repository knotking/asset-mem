import * as React from 'react';
import Constants from 'expo-constants';
import { LlmTokenUsageProvider } from '@asset-mem/common/contexts/llm-token-usage-context';
import { useAuth } from '@asset-mem/common/contexts/auth-context';
import { useFirebase } from '@asset-mem/common/contexts/firebase-context';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';

/** Wires @asset-mem/common LlmTokenUsageProvider with Expo `extra` (proxy URLs). */
export function MappLlmTokenUsageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { db } = useFirebase();
  const extra = Constants.expoConfig?.extra ?? {};
  const tokenQuotaStatusUrl = (extra.tokenQuotaStatusUrl as string | undefined) ?? '';

  return (
    <LlmTokenUsageProvider
      db={db}
      uid={user?.uid}
      tokenQuotaStatusUrl={tokenQuotaStatusUrl}
      getIdToken={getFirebaseIdTokenForProxy}
    >
      {children}
    </LlmTokenUsageProvider>
  );
}
