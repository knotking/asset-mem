'use client';

import * as React from 'react';
import { DeletionConfigProvider } from '@homeapp/common/contexts/deletion-config-context';
import { getWebDeletionApiUrls } from '@/lib/api-deletion';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';

export function WebDeletionConfigProvider({ children }: { children: React.ReactNode }) {
  const urls = React.useMemo(() => getWebDeletionApiUrls(), []);
  return (
    <DeletionConfigProvider urls={urls} getIdToken={getFirebaseIdTokenForProxy}>
      {children}
    </DeletionConfigProvider>
  );
}
