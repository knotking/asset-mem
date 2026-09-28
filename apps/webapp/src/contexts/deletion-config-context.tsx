/**
 * Mirrored from @asset-mem/common — webapp cannot import common (App Hosting).
 * Keep in sync with apps/common/src/contexts/deletion-config-context.tsx
 */
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { GetFirebaseIdToken } from '@/lib/correlation-id';
import type { DeletionApiUrls } from '@/lib/deletion/api-client';

export type DeletionConfig = {
  urls: DeletionApiUrls | null;
  getIdToken: GetFirebaseIdToken;
};

const DeletionConfigContext = createContext<DeletionConfig | null>(null);

export function DeletionConfigProvider({
  urls,
  getIdToken,
  children,
}: {
  urls: DeletionApiUrls | null;
  getIdToken: GetFirebaseIdToken;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ urls, getIdToken }), [urls, getIdToken]);
  return (
    <DeletionConfigContext.Provider value={value}>{children}</DeletionConfigContext.Provider>
  );
}

export function useDeletionConfig(): DeletionConfig | null {
  return useContext(DeletionConfigContext);
}
