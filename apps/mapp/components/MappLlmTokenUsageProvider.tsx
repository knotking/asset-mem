import * as React from 'react';
import Constants from 'expo-constants';
import { LlmTokenUsageProvider } from '@homeapp/common/contexts/llm-token-usage-context';
import { useAuth } from '@homeapp/common/contexts/auth-context';
import { useFirebase } from '@homeapp/common/contexts/firebase-context';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';

function parsePositiveInt(raw: unknown): number | null {
  if (raw == null || String(raw).trim() === '') return null;
  const n = parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Wires @homeapp/common LlmTokenUsageProvider with Expo `extra` (proxy URLs + optional quota fallback). */
export function MappLlmTokenUsageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { db } = useFirebase();
  const extra = Constants.expoConfig?.extra ?? {};
  const tokenQuotaStatusUrl = (extra.tokenQuotaStatusUrl as string | undefined) ?? '';
  const publicDefaultMonthlyTokenLimit = parsePositiveInt(extra.tokenQuotaPeriodMaxTokens);

  return (
    <LlmTokenUsageProvider
      db={db}
      uid={user?.uid}
      tokenQuotaStatusUrl={tokenQuotaStatusUrl}
      getIdToken={getFirebaseIdTokenForProxy}
      publicDefaultMonthlyTokenLimit={publicDefaultMonthlyTokenLimit}
    >
      {children}
    </LlmTokenUsageProvider>
  );
}
