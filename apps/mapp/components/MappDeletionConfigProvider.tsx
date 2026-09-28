import * as React from 'react';
import { DeletionConfigProvider } from '@asset-mem/common/contexts/deletion-config-context';
import { getMappDeletionApiUrls } from '@/lib/deletion-api';
import { getFirebaseIdTokenForProxy } from '@/lib/proxy-auth';

export function MappDeletionConfigProvider({ children }: { children: React.ReactNode }) {
  const urls = React.useMemo(() => getMappDeletionApiUrls(), []);
  return (
    <DeletionConfigProvider urls={urls} getIdToken={getFirebaseIdTokenForProxy}>
      {children}
    </DeletionConfigProvider>
  );
}
